import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Link, Unlink, Search,
  FileCheck, AlertTriangle, Loader2, ChevronDown, ChevronUp, FilePlus,
} from 'lucide-react';
import { contratosAjustadosApi, suppliersApi, projectsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import clsx from 'clsx';
import type { ContratoAjustado, ContratoResumen } from '../../types';

const fmt = (n: number) =>
  'RD$' + n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ESTADO_CFG = {
  ACTIVO:     { label: 'Activo',     cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
  COMPLETADO: { label: 'Completado', cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  CANCELADO:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
} as const;

type ContratoForm = {
  projectId: string; supplierId: string; descripcionTrabajo: string;
  montoContratado: string; fechaContrato: string; observaciones: string;
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
};

const EMPTY_FORM: ContratoForm = {
  projectId: '', supplierId: '', descripcionTrabajo: '',
  montoContratado: '', fechaContrato: new Date().toISOString().split('T')[0],
  observaciones: '', estado: 'ACTIVO',
};

function ProgressBar({ pct, sobregirado }: { pct: number; sobregirado: boolean }) {
  const clamped = Math.min(pct, 100);
  const color = sobregirado ? 'bg-red-500' : pct >= 90 ? 'bg-[#F5C218]' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 h-1.5 overflow-hidden">
        <div className={clsx('h-1.5 transition-all', color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={clsx('text-xs font-bold w-10 text-right font-[\'Space_Mono\']', sobregirado ? 'text-red-600' : pct >= 90 ? 'text-amber-600' : 'text-gray-600')}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Modal formulario ──────────────────────────────────────────
function ContratoFormModal({ editing, onClose, onSuccess }: {
  editing: ContratoAjustado | null; onClose: () => void; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ContratoForm>(
    editing ? {
      projectId: editing.projectId, supplierId: editing.supplierId,
      descripcionTrabajo: editing.descripcionTrabajo, montoContratado: String(editing.montoContratado),
      fechaContrato: editing.fechaContrato.split('T')[0], observaciones: editing.observaciones ?? '',
      estado: editing.estado,
    } : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const { data: projectsRes } = useQuery({ queryKey: ['projects-active'], queryFn: () => projectsApi.list({ status: 'ACTIVE', limit: 100 }) });
  const { data: suppliersRes } = useQuery({ queryKey: ['suppliers-active'], queryFn: () => suppliersApi.list({ onlyActive: true }) });

  const projects  = projectsRes?.data?.data ?? [];
  const suppliers = suppliersRes?.data?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        projectId: form.projectId, supplierId: form.supplierId,
        descripcionTrabajo: form.descripcionTrabajo, montoContratado: parseFloat(form.montoContratado),
        fechaContrato: form.fechaContrato, ...(editing ? { estado: form.estado } : {}),
      };
      if (form.observaciones?.trim()) payload.observaciones = form.observaciones;
      return editing ? contratosAjustadosApi.update(editing.id, payload) : contratosAjustadosApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contratos-ajustados'] }); qc.invalidateQueries({ queryKey: ['contratos-resumen'] }); onSuccess(); },
    onError: (e: any) => {
      const details = e.response?.data?.details;
      if (details && Object.keys(details).length > 0) {
        setError(Object.entries(details).map(([f, errs]: any) => `${f}: ${(errs as string[]).join(', ')}`).join(' | '));
      } else {
        setError(e.response?.data?.error ?? 'Error al guardar el contrato');
      }
    },
  });

  const set = (k: keyof ContratoForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.projectId)           return setError('Selecciona un proyecto');
    if (!form.supplierId)          return setError('Selecciona un suplidor');
    if (!form.descripcionTrabajo.trim()) return setError('La descripción es requerida');
    const monto = parseFloat(form.montoContratado);
    if (isNaN(monto) || monto <= 0) return setError('El monto contratado debe ser mayor a 0');
    if (!form.fechaContrato)       return setError('La fecha es requerida');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
          <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">
            {editing ? 'Editar Contrato' : 'Nuevo Contrato Ajustado'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Proyecto</label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]">
              <option value="">Seleccionar proyecto...</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Suplidor</label>
            <select value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]">
              <option value="">Seleccionar suplidor...</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` (${s.rnc})` : ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descripción del Trabajo</label>
            <textarea value={form.descripcionTrabajo} onChange={(e) => set('descripcionTrabajo', e.target.value)}
              rows={3} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C] resize-none"
              placeholder="Descripción detallada del trabajo contratado..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Monto (RD$)</label>
              <input type="number" min="0" step="0.01" value={form.montoContratado} onChange={(e) => set('montoContratado', e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#1C1C1C]" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fecha de Contrato</label>
              <input type="date" value={form.fechaContrato} onChange={(e) => set('fechaContrato', e.target.value)}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]" />
            </div>
          </div>

          {editing && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => set('estado', e.target.value as ContratoForm['estado'])}
                className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C]">
                <option value="ACTIVO">Activo</option>
                <option value="COMPLETADO">Completado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Observaciones (opcional)</label>
            <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)}
              rows={2} className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1C1C1C] resize-none"
              placeholder="Notas adicionales..." />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wide">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="px-4 py-2.5 text-sm font-bold bg-[#F5C218] text-[#1C1C1C] hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-wide">
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar Cambios' : 'Crear Contrato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal vincular gasto ──────────────────────────────────────
function VincularGastoModal({ contratoId, projectId, onClose, onSuccess }: {
  contratoId: string; projectId: string; onClose: () => void; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [error,    setError]    = useState('');

  const { data: expRes, isLoading } = useQuery({
    queryKey: ['available-expenses', contratoId],
    queryFn:  () => contratosAjustadosApi.availableExpenses(contratoId),
  });

  const expenses = (expRes?.data?.data ?? []) as Array<{
    id: string; description: string; amount: number; expenseDate: string; categoryName?: string;
  }>;

  const filtered = expenses.filter((e) => e.description.toLowerCase().includes(search.toLowerCase()));

  const mutation = useMutation({
    mutationFn: () => contratosAjustadosApi.linkExpense(contratoId, selected!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contrato-detail', contratoId] });
      onSuccess();
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Error al vincular gasto'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        <div className="bg-[#1C1C1C] flex items-center justify-between px-6 py-4">
          <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Vincular Gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#1C1C1C]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {expenses.length === 0 ? 'No hay gastos disponibles para este contrato' : 'Sin resultados'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((exp) => (
                <label key={exp.id}
                  className={clsx('flex items-center gap-3 p-3 border cursor-pointer transition-colors',
                    selected === exp.id ? 'border-[#1C1C1C] bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
                  )}>
                  <input type="radio" name="expense" value={exp.id}
                    checked={selected === exp.id} onChange={() => setSelected(exp.id)}
                    className="accent-[#1C1C1C]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{exp.description}</p>
                    <p className="text-xs text-gray-400 font-['Space_Mono']">{fmtDate(exp.expenseDate)}</p>
                  </div>
                  <span className="text-sm font-black text-[#1C1C1C] shrink-0 font-['Space_Mono']">{fmt(exp.amount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wide">
            Cancelar
          </button>
          <button disabled={!selected || mutation.isPending} onClick={() => mutation.mutate()}
            className="px-4 py-2.5 text-sm font-bold bg-[#F5C218] text-[#1C1C1C] hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center gap-2 uppercase tracking-wide">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Vincular Gasto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel de detalle ──────────────────────────────────────────
function ContratoDetailPanel({ contrato, onClose, onEdit, canEdit }: {
  contrato: ContratoAjustado; onClose: () => void; onEdit: () => void; canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [showVincular,   setShowVincular]   = useState(false);
  const [unlinkError,    setUnlinkError]    = useState('');
  const [showAdendaForm, setShowAdendaForm] = useState(false);
  const [adendaForm,     setAdendaForm]     = useState({ monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] });
  const [adendaError,    setAdendaError]    = useState('');

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['contrato-detail', contrato.id],
    queryFn:  () => contratosAjustadosApi.getById(contrato.id),
  });

  const detail: any = detailRes?.data?.data ?? contrato;

  const unlinkMutation = useMutation({
    mutationFn: (expenseId: string) => contratosAjustadosApi.unlinkExpense(contrato.id, expenseId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contratos-ajustados'] }); qc.invalidateQueries({ queryKey: ['contrato-detail', contrato.id] }); },
    onError: (e: any) => setUnlinkError(e.response?.data?.error ?? 'Error al desvincular'),
  });

  const addAdendaMut = useMutation({
    mutationFn: () => contratosAjustadosApi.createAdenda(contrato.id, {
      monto: parseFloat(adendaForm.monto), descripcion: adendaForm.descripcion, fecha: adendaForm.fecha,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contrato-detail', contrato.id] });
      qc.invalidateQueries({ queryKey: ['payment-orders', 'contracts'] });
      setShowAdendaForm(false); setAdendaError('');
      setAdendaForm({ monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] });
    },
    onError: (e: any) => setAdendaError(e.response?.data?.error ?? 'Error al agregar adenda'),
  });

  const deleteAdendaMut = useMutation({
    mutationFn: (adendaId: string) => contratosAjustadosApi.deleteAdenda(contrato.id, adendaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contrato-detail', contrato.id] });
      qc.invalidateQueries({ queryKey: ['payment-orders', 'contracts'] });
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="bg-[#1C1C1C] sticky top-0 z-10 flex items-start justify-between px-6 py-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Contrato Ajustado</h2>
                <span className={clsx('text-xs px-2 py-0.5 font-bold uppercase tracking-wide', ESTADO_CFG[detail.estado].cls)}>
                  {ESTADO_CFG[detail.estado].label}
                </span>
                {detail.sobregirado && (
                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 font-bold">
                    <AlertTriangle className="w-3 h-3" /> SOBREGIRADO
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-0.5 font-['Space_Mono']">{detail.project?.code} · {detail.project?.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-600 hover:border-[#F5C218] hover:text-[#F5C218] text-gray-300 transition-colors font-bold uppercase tracking-wide">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Suplidor</p>
                  <p className="font-bold text-gray-800">{detail.supplier?.name}</p>
                  {detail.supplier?.rnc && <p className="text-xs text-gray-400 font-['Space_Mono']">RNC: {detail.supplier.rnc}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Fecha de Contrato</p>
                  <p className="font-bold text-gray-800">{fmtDate(detail.fechaContrato)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Descripción del Trabajo</p>
                  <p className="font-medium text-gray-800">{detail.descripcionTrabajo}</p>
                </div>
                {detail.observaciones && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5 font-['Space_Mono']">Observaciones</p>
                    <p className="text-gray-700">{detail.observaciones}</p>
                  </div>
                )}
              </div>

              {/* Financiero */}
              <div className="bg-[#1C1C1C] p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-['Space_Mono']">Monto base</p>
                    <p className="font-black text-white font-['Space_Mono'] text-lg">{fmt(Number(detail.montoContratado))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-['Space_Mono']">Pagado</p>
                    <p className="font-black text-green-400 font-['Space_Mono'] text-lg">{fmt(detail.pagadoAcumulado ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-['Space_Mono']">Balance</p>
                    <p className={clsx('font-black font-[\'Space_Mono\'] text-lg', detail.sobregirado ? 'text-red-400' : 'text-[#F5C218]')}>
                      {fmt(detail.balancePendiente ?? 0)}
                    </p>
                  </div>
                </div>
                {(detail.adendas?.length ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-xs bg-[#2a2a2a] px-3 py-1.5 text-[#F5C218] font-['Space_Mono']">
                    <span>+ Adendas: <strong>{fmt(detail.sumAdendas ?? 0)}</strong></span>
                    <span>Total efectivo: <strong>{fmt(detail.montoEfectivo ?? Number(detail.montoContratado))}</strong></span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-['Space_Mono']">Progreso de ejecución</p>
                  <ProgressBar pct={detail.porcentajeEjecutado ?? 0} sobregirado={detail.sobregirado ?? false} />
                </div>
              </div>

              {/* Adendas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-[#1C1C1C] uppercase tracking-wide font-['Barlow_Condensed']">
                    Adendas por monto ({detail.adendas?.length ?? 0})
                  </h3>
                  {canEdit && detail.estado === 'ACTIVO' && !showAdendaForm && (
                    <button onClick={() => setShowAdendaForm(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1C1C1C] text-[#F5C218] hover:bg-gray-800 transition-colors font-bold uppercase tracking-wide">
                      <FilePlus className="w-3.5 h-3.5" /> Nueva adenda
                    </button>
                  )}
                </div>

                {showAdendaForm && (
                  <div className="bg-gray-50 border border-gray-200 p-4 mb-3 space-y-3">
                    <p className="text-xs font-bold text-[#1C1C1C] uppercase tracking-wide font-['Space_Mono']">Nueva adenda de monto</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Monto adicional *</label>
                        <input type="number" min="1" step="0.01" className="w-full border border-gray-200 px-3 py-2 text-sm font-['Space_Mono'] focus:outline-none focus:border-[#1C1C1C]"
                          placeholder="0.00" value={adendaForm.monto} onChange={(e) => setAdendaForm((f) => ({ ...f, monto: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fecha *</label>
                        <input type="date" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1C1C1C]"
                          value={adendaForm.fecha} onChange={(e) => setAdendaForm((f) => ({ ...f, fecha: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Descripción *</label>
                      <input type="text" className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1C1C1C]"
                        placeholder="Ej: Ampliación alcance trabajos adicionales"
                        value={adendaForm.descripcion} onChange={(e) => setAdendaForm((f) => ({ ...f, descripcion: e.target.value }))} />
                    </div>
                    {adendaError && <p className="text-xs text-red-600">{adendaError}</p>}
                    <div className="flex gap-2">
                      <button disabled={addAdendaMut.isPending}
                        onClick={() => {
                          setAdendaError('');
                          const m = parseFloat(adendaForm.monto);
                          if (isNaN(m) || m <= 0) return setAdendaError('El monto debe ser mayor a 0');
                          if (!adendaForm.descripcion.trim()) return setAdendaError('La descripción es requerida');
                          if (!adendaForm.fecha) return setAdendaError('La fecha es requerida');
                          addAdendaMut.mutate();
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-[#F5C218] text-[#1C1C1C] hover:bg-yellow-300 disabled:opacity-50 flex items-center gap-1.5 uppercase tracking-wide">
                        {addAdendaMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        Agregar adenda
                      </button>
                      <button onClick={() => { setShowAdendaForm(false); setAdendaError(''); setAdendaForm({ monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] }); }}
                        className="px-3 py-1.5 text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 uppercase tracking-wide">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {(!detail.adendas || detail.adendas.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200">
                    No hay adendas registradas
                  </p>
                ) : (
                  <div className="border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1C1C1C] border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-bold text-white uppercase tracking-wide font-['Space_Mono']">#</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Descripción</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Fecha</th>
                          <th className="text-right px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Monto adicional</th>
                          {canEdit && <th className="px-3 py-2" />}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.adendas.map((a: any) => (
                          <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 font-['Space_Mono'] text-xs">A-{String(a.number).padStart(2, '0')}</td>
                            <td className="px-3 py-2 text-gray-800">{a.descripcion}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs font-['Space_Mono']">{fmtDate(a.fecha)}</td>
                            <td className="px-3 py-2 text-right font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(Number(a.monto))}</td>
                            {canEdit && (
                              <td className="px-3 py-2 text-right">
                                <button onClick={() => deleteAdendaMut.mutate(a.id)} disabled={deleteAdendaMut.isPending}
                                  className="text-gray-400 hover:text-red-500 transition-colors" title="Eliminar adenda">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Gastos vinculados */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-[#1C1C1C] uppercase tracking-wide font-['Barlow_Condensed']">
                    Gastos Vinculados ({detail.expenses?.length ?? 0})
                  </h3>
                  {canEdit && detail.estado === 'ACTIVO' && (
                    <button onClick={() => setShowVincular(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1C1C1C] text-[#F5C218] hover:bg-gray-800 transition-colors font-bold uppercase tracking-wide">
                      <Link className="w-3.5 h-3.5" /> Vincular Gasto
                    </button>
                  )}
                </div>

                {unlinkError && (
                  <div className="mb-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{unlinkError}
                  </div>
                )}

                {(!detail.expenses || detail.expenses.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200">
                    No hay gastos vinculados
                  </p>
                ) : (
                  <div className="border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1C1C1C] border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Descripción</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Fecha</th>
                          <th className="text-right px-3 py-2 text-xs font-bold text-white uppercase tracking-wide">Monto</th>
                          {canEdit && <th className="px-3 py-2" />}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.expenses.map((exp: any) => (
                          <tr key={exp.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">{exp.description}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs font-['Space_Mono']">{fmtDate(exp.expenseDate)}</td>
                            <td className="px-3 py-2 text-right font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(exp.amount)}</td>
                            {canEdit && (
                              <td className="px-3 py-2 text-right">
                                <button onClick={() => unlinkMutation.mutate(exp.id)} disabled={unlinkMutation.isPending}
                                  className="text-gray-400 hover:text-red-500 transition-colors" title="Desvincular">
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showVincular && (
        <VincularGastoModal
          contratoId={contrato.id}
          projectId={contrato.projectId}
          onClose={() => setShowVincular(false)}
          onSuccess={() => setShowVincular(false)}
        />
      )}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function ContratosAjustadosPage() {
  const { isSupervisor, isOperator, role } = useRole();
  const qc = useQueryClient();

  const [search,         setSearch]         = useState('');
  const [filterProject,  setFilterProject]  = useState('');
  const [filterEstado,   setFilterEstado]   = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editing,        setEditing]        = useState<ContratoAjustado | null>(null);
  const [detailContrato, setDetailContrato] = useState<ContratoAjustado | null>(null);
  const [deleteId,       setDeleteId]       = useState<string | null>(null);
  const [deleteError,    setDeleteError]    = useState('');
  const [expandedResumen, setExpandedResumen] = useState(false);

  const canCreate = isSupervisor || isOperator;
  const canEdit   = isSupervisor;
  const canDelete = role === 'admin';

  const { data: listRes, isLoading, isError } = useQuery({
    queryKey: ['contratos-ajustados', { search, filterProject, filterEstado }],
    queryFn:  () => contratosAjustadosApi.list({ search: search || undefined, projectId: filterProject || undefined, estado: filterEstado || undefined, limit: 100 }),
  });

  const { data: resumenRes } = useQuery({ queryKey: ['contratos-resumen'], queryFn: () => contratosAjustadosApi.resumen() });

  const { data: projectsRes } = useQuery({ queryKey: ['projects-active'], queryFn: () => projectsApi.list({ status: 'ACTIVE', limit: 100 }) });

  const contratos: ContratoAjustado[] = listRes?.data?.data ?? [];
  const resumen: ContratoResumen | null = resumenRes?.data?.data ?? null;
  const projects = projectsRes?.data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contratosAjustadosApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contratos-ajustados'] }); qc.invalidateQueries({ queryKey: ['contratos-resumen'] }); setDeleteId(null); },
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Error al eliminar'),
  });

  const handleEdit = (c: ContratoAjustado) => { setDetailContrato(null); setEditing(c); setShowForm(true); };

  return (
    <div className="font-['DM_Sans'] space-y-0">

      {/* Hero Header */}
      <div className="bg-[#1C1C1C] px-4 md:px-6 py-4 md:py-5 mb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[#F5C218] text-xs font-bold tracking-[0.2em] uppercase font-['Space_Mono'] mb-2">
              MÓDULO / CONTRATOS
            </p>
            <h1 className="text-3xl md:text-5xl font-black text-white font-['Barlow_Condensed'] uppercase tracking-tight leading-none">
              CONTRATOS AJUSTADOS
            </h1>
            <p className="text-gray-400 text-sm mt-2">Seguimiento de contratos por suplidor y proyecto</p>
          </div>
          <div className="flex items-center gap-4">
            {resumen && resumen.indicadores.sobregirados > 0 && (
              <div className="bg-red-900/50 border border-red-500 px-3 py-2 text-center">
                <p className="text-xs font-bold text-red-400 font-['Space_Mono'] uppercase">Sobregirados</p>
                <p className="text-2xl font-black text-red-300 font-['Space_Mono']">{resumen.indicadores.sobregirados}</p>
              </div>
            )}
            {canCreate && (
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-5 py-3 font-bold text-sm uppercase tracking-wide hover:bg-yellow-300 transition-colors">
                <Plus className="w-4 h-4" /> Nuevo Contrato
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-5">

        {/* Tarjetas resumen */}
        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
            <div className="bg-white p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 font-['Space_Mono']">Total Contratado</p>
              <p className="text-xl font-black text-[#1C1C1C] font-['Space_Mono']">{fmt(resumen.totales.contratado)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 font-['Space_Mono']">Total Pagado</p>
              <p className="text-xl font-black text-green-700 font-['Space_Mono']">{fmt(resumen.totales.pagado)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 font-['Space_Mono']">Balance Pendiente</p>
              <p className="text-xl font-black text-[#F5C218] font-['Space_Mono']">{fmt(resumen.totales.pendiente)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 font-['Space_Mono']">Contratos Activos</p>
              <p className="text-xl font-black text-[#1C1C1C] font-['Space_Mono']">{resumen.indicadores.activos}</p>
            </div>
          </div>
        )}

        {/* Desglose expandible */}
        {resumen && (resumen.porProyecto.length > 0 || resumen.porSuplidor.length > 0) && (
          <div className="bg-white border border-gray-200">
            <button onClick={() => setExpandedResumen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-[0.15em] hover:bg-gray-50 transition-colors font-['Space_Mono']">
              <span>Ver desglose por proyecto y suplidor</span>
              {expandedResumen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedResumen && (
              <div className="border-t border-gray-100 p-5 grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 font-['Space_Mono']">Por Proyecto</h4>
                  <div className="space-y-2">
                    {resumen.porProyecto.slice(0, 5).map((row) => (
                      <div key={row.project.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate flex-1">{row.project.code} · {row.project.name}</span>
                        <span className="text-gray-500 ml-4 font-['Space_Mono'] text-xs">{fmt(row.contratado)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 font-['Space_Mono']">Por Suplidor</h4>
                  <div className="space-y-2">
                    {resumen.porSuplidor.slice(0, 5).map((row) => (
                      <div key={row.supplier.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate flex-1">{row.supplier.name}</span>
                        <span className="text-gray-500 ml-4 font-['Space_Mono'] text-xs">{fmt(row.contratado)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white border border-gray-200 p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción o suplidor..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#1C1C1C]" />
          </div>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1C1C1C]">
            <option value="">Todos los proyectos</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
          </select>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
            className="border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1C1C1C]">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="COMPLETADO">Completado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
              <p className="text-sm text-red-600">Error al cargar los contratos</p>
            </div>
          ) : contratos.length === 0 ? (
            <div className="bg-[#1C1C1C] flex flex-col items-center justify-center py-16 text-center">
              <FileCheck className="w-10 h-10 text-[#F5C218] mb-3" />
              <p className="text-white font-bold font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Sin contratos registrados</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || filterProject || filterEstado ? 'Prueba con otros filtros' : 'Crea el primer contrato ajustado'}
              </p>
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {contratos.map((c) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#1C1C1C] font-['Space_Mono'] text-xs">{c.project?.code}</p>
                      <p className="text-xs text-gray-500 truncate">{c.project?.name}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <span className={clsx('text-xs px-2 py-0.5 font-bold uppercase tracking-wide', ESTADO_CFG[c.estado].cls)}>
                        {ESTADO_CFG[c.estado].label}
                      </span>
                      {c.sobregirado && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-bold">
                          <AlertTriangle className="w-3 h-3" /> Sobregirado
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{c.supplier?.name}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{c.descripcionTrabajo}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-400 font-['Space_Mono'] uppercase">Contratado</p>
                      <p className="font-black text-[#1C1C1C] font-['Space_Mono'] text-sm">{fmt(c.montoEfectivo ?? c.montoContratado)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-['Space_Mono'] uppercase">Pagado</p>
                      <p className="font-bold text-green-700 font-['Space_Mono'] text-sm">{fmt(c.pagadoAcumulado)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-['Space_Mono'] uppercase">Balance</p>
                      <p className={clsx('font-black font-[\'Space_Mono\'] text-sm', c.sobregirado ? 'text-red-600' : 'text-[#F5C218]')}>
                        {fmt(c.balancePendiente)}
                      </p>
                    </div>
                  </div>
                  <ProgressBar pct={c.porcentajeEjecutado} sobregirado={c.sobregirado} />
                  <div className="flex items-center gap-1 pt-1">
                    <button onClick={() => setDetailContrato(c)}
                      className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-[#F5C218] transition-colors" title="Ver detalle">
                      <FileCheck className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => handleEdit(c)}
                        className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-gray-100 transition-colors" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => { setDeleteId(c.id); setDeleteError(''); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1C1C1C]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono']">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono']">Suplidor</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Descripción</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide font-['Space_Mono']">Contratado</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell font-['Space_Mono']">Pagado</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell font-['Space_Mono']">Balance</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Progreso</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contratos.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-black text-[#1C1C1C] font-['Space_Mono'] text-xs">{c.project?.code}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[120px]">{c.project?.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-[140px]">{c.supplier?.name}</p>
                        {c.supplier?.rnc && <p className="text-xs text-gray-400 font-['Space_Mono']">{c.supplier.rnc}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-gray-700 truncate max-w-[200px]">{c.descripcionTrabajo}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[#1C1C1C] whitespace-nowrap font-['Space_Mono']">
                        {fmt(c.montoEfectivo ?? c.montoContratado)}
                        {c.sumAdendas > 0 && (
                          <p className="text-[10px] text-indigo-400 font-normal">+{fmt(c.sumAdendas)} adendas</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 hidden md:table-cell whitespace-nowrap font-['Space_Mono'] font-bold">
                        {fmt(c.pagadoAcumulado)}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                        <span className={clsx('font-black font-[\'Space_Mono\']', c.sobregirado ? 'text-red-600' : 'text-[#F5C218]')}>
                          {fmt(c.balancePendiente)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell w-36">
                        <ProgressBar pct={c.porcentajeEjecutado} sobregirado={c.sobregirado} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={clsx('text-xs px-2 py-0.5 font-bold uppercase tracking-wide w-fit', ESTADO_CFG[c.estado].cls)}>
                            {ESTADO_CFG[c.estado].label}
                          </span>
                          {c.sobregirado && (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-bold">
                              <AlertTriangle className="w-3 h-3" /> Sobregirado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setDetailContrato(c)}
                            className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-[#F5C218] transition-colors" title="Ver detalle">
                            <FileCheck className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button onClick={() => handleEdit(c)}
                              className="p-1.5 text-gray-400 hover:text-[#1C1C1C] hover:bg-gray-100 transition-colors" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => { setDeleteId(c.id); setDeleteError(''); }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Modal formulario */}
      {showForm && (
        <ContratoFormModal
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSuccess={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Panel de detalle */}
      {detailContrato && (
        <ContratoDetailPanel
          contrato={detailContrato}
          onClose={() => setDetailContrato(null)}
          onEdit={() => handleEdit(detailContrato)}
          canEdit={canEdit}
        />
      )}

      {/* Confirmación de borrado */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-sm shadow-2xl">
            <div className="bg-red-600 flex items-center gap-3 px-6 py-4">
              <Trash2 className="w-5 h-5 text-white" />
              <h3 className="font-black text-white font-['Barlow_Condensed'] text-xl uppercase tracking-wide">Eliminar Contrato</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                ¿Estás seguro de que deseas eliminar este contrato? Esta acción no se puede deshacer.
              </p>
              {deleteError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border-l-4 border-red-500 px-3 py-2 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{deleteError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteId(null)}
                  className="px-4 py-2.5 text-sm font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors uppercase tracking-wide">
                  Cancelar
                </button>
                <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                  className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 uppercase tracking-wide">
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
