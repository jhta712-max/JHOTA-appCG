import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Pencil, Trash2, Link, Unlink, Search,
  FileCheck, AlertTriangle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { contratosAjustadosApi, suppliersApi, projectsApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import clsx from 'clsx';
import type { ContratoAjustado, ContratoResumen } from '../../types';

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) =>
  'RD$' + n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Estado config ─────────────────────────────────────────────
const ESTADO_CFG = {
  ACTIVO:     { label: 'Activo',     cls: 'bg-green-100 text-green-700' },
  COMPLETADO: { label: 'Completado', cls: 'bg-blue-100 text-blue-700' },
  CANCELADO:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
} as const;

// ── Tipos de formulario ───────────────────────────────────────
type ContratoForm = {
  projectId: string;
  supplierId: string;
  descripcionTrabajo: string;
  montoContratado: string;
  fechaContrato: string;
  observaciones: string;
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
};

const EMPTY_FORM: ContratoForm = {
  projectId: '',
  supplierId: '',
  descripcionTrabajo: '',
  montoContratado: '',
  fechaContrato: new Date().toISOString().split('T')[0],
  observaciones: '',
  estado: 'ACTIVO',
};

// ── Barra de progreso ─────────────────────────────────────────
function ProgressBar({ pct, sobregirado }: { pct: number; sobregirado: boolean }) {
  const clamped = Math.min(pct, 100);
  const color = sobregirado
    ? 'bg-red-500'
    : pct >= 90
    ? 'bg-amber-500'
    : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className={clsx('h-2 rounded-full transition-all', color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={clsx('text-xs font-medium w-10 text-right', sobregirado ? 'text-red-600' : pct >= 90 ? 'text-amber-600' : 'text-gray-600')}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Tarjetas de resumen ───────────────────────────────────────
function ResumenCards({ resumen }: { resumen: ContratoResumen }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Total Contratado</p>
        <p className="text-lg font-bold text-gray-900">{fmt(resumen.totales.contratado)}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Total Pagado</p>
        <p className="text-lg font-bold text-green-700">{fmt(resumen.totales.pagado)}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Balance Pendiente</p>
        <p className="text-lg font-bold text-amber-700">{fmt(resumen.totales.pendiente)}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Contratos Activos</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-bold text-gray-900">{resumen.indicadores.activos}</p>
          {resumen.indicadores.sobregirados > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {resumen.indicadores.sobregirados} sobregirado{resumen.indicadores.sobregirados > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de formulario (crear/editar) ────────────────────────
function ContratoFormModal({
  editing,
  onClose,
  onSuccess,
}: {
  editing: ContratoAjustado | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ContratoForm>(
    editing
      ? {
          projectId: editing.projectId,
          supplierId: editing.supplierId,
          descripcionTrabajo: editing.descripcionTrabajo,
          montoContratado: String(editing.montoContratado),
          fechaContrato: editing.fechaContrato.split('T')[0],
          observaciones: editing.observaciones ?? '',
          estado: editing.estado,
        }
      : EMPTY_FORM,
  );
  const [error, setError] = useState('');

  const { data: projectsRes } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
  });
  const { data: suppliersRes } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: () => suppliersApi.list({ onlyActive: true }),
  });

  const projects = projectsRes?.data?.data ?? [];
  const suppliers = suppliersRes?.data?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        projectId: form.projectId,
        supplierId: form.supplierId,
        descripcionTrabajo: form.descripcionTrabajo,
        montoContratado: parseFloat(form.montoContratado),
        fechaContrato: form.fechaContrato,
        observaciones: form.observaciones || null,
        ...(editing ? { estado: form.estado } : {}),
      };
      return editing
        ? contratosAjustadosApi.update(editing.id, payload)
        : contratosAjustadosApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contratos-resumen'] });
      onSuccess();
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Error al guardar el contrato'),
  });

  const set = (k: keyof ContratoForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.projectId) return setError('Selecciona un proyecto');
    if (!form.supplierId) return setError('Selecciona un suplidor');
    if (!form.descripcionTrabajo.trim()) return setError('La descripción es requerida');
    const monto = parseFloat(form.montoContratado);
    if (isNaN(monto) || monto <= 0) return setError('El monto contratado debe ser mayor a 0');
    if (!form.fechaContrato) return setError('La fecha es requerida');
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? 'Editar Contrato' : 'Nuevo Contrato Ajustado'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Proyecto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
            <select
              value={form.projectId}
              onChange={(e) => set('projectId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar proyecto...</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          {/* Suplidor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suplidor</label>
            <select
              value={form.supplierId}
              onChange={(e) => set('supplierId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar suplidor...</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` (${s.rnc})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Trabajo</label>
            <textarea
              value={form.descripcionTrabajo}
              onChange={(e) => set('descripcionTrabajo', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción detallada del trabajo contratado..."
            />
          </div>

          {/* Monto + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Contratado (RD$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.montoContratado}
                onChange={(e) => set('montoContratado', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Contrato</label>
              <input
                type="date"
                value={form.fechaContrato}
                onChange={(e) => set('fechaContrato', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Estado (solo en edición) */}
          {editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => set('estado', e.target.value as ContratoForm['estado'])}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVO">Activo</option>
                <option value="COMPLETADO">Completado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notas adicionales..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
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
function VincularGastoModal({
  contratoId,
  projectId,
  onClose,
  onSuccess,
}: {
  contratoId: string;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: expRes, isLoading } = useQuery({
    queryKey: ['available-expenses', contratoId],
    queryFn: () => contratosAjustadosApi.availableExpenses(contratoId),
  });

  const expenses = (expRes?.data?.data ?? []) as Array<{
    id: string; description: string; amount: number; expenseDate: string; categoryName?: string;
  }>;

  const filtered = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()),
  );

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Vincular Gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descripción..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {expenses.length === 0 ? 'No hay gastos disponibles para este contrato' : 'Sin resultados para la búsqueda'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((exp) => (
                <label key={exp.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selected === exp.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50',
                  )}>
                  <input
                    type="radio"
                    name="expense"
                    value={exp.id}
                    checked={selected === exp.id}
                    onChange={() => setSelected(exp.id)}
                    className="text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{exp.description}</p>
                    <p className="text-xs text-gray-500">{fmtDate(exp.expenseDate)}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">{fmt(exp.amount)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            disabled={!selected || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Vincular Gasto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel de detalle ──────────────────────────────────────────
function ContratoDetailPanel({
  contrato,
  onClose,
  onEdit,
  canEdit,
}: {
  contrato: ContratoAjustado;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [showVincular, setShowVincular] = useState(false);
  const [unlinkError, setUnlinkError] = useState('');

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['contrato-detail', contrato.id],
    queryFn: () => contratosAjustadosApi.getById(contrato.id),
  });

  const detail: ContratoAjustado = detailRes?.data?.data ?? contrato;

  const unlinkMutation = useMutation({
    mutationFn: (expenseId: string) => contratosAjustadosApi.unlinkExpense(contrato.id, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contrato-detail', contrato.id] });
    },
    onError: (e: any) => setUnlinkError(e.response?.data?.error ?? 'Error al desvincular'),
  });

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900">Contrato Ajustado</h2>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_CFG[detail.estado].cls)}>
                  {ESTADO_CFG[detail.estado].label}
                </span>
                {detail.sobregirado && (
                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    <AlertTriangle className="w-3 h-3" /> Sobregirado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{detail.project?.code} · {detail.project?.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Suplidor</p>
                  <p className="font-medium text-gray-800">{detail.supplier?.name}</p>
                  {detail.supplier?.rnc && <p className="text-xs text-gray-400">RNC: {detail.supplier.rnc}</p>}
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Fecha de Contrato</p>
                  <p className="font-medium text-gray-800">{fmtDate(detail.fechaContrato)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs mb-0.5">Descripción del Trabajo</p>
                  <p className="font-medium text-gray-800">{detail.descripcionTrabajo}</p>
                </div>
                {detail.observaciones && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs mb-0.5">Observaciones</p>
                    <p className="text-gray-700">{detail.observaciones}</p>
                  </div>
                )}
              </div>

              {/* Financiero */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Contratado</p>
                    <p className="font-bold text-gray-900">{fmt(detail.montoContratado)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Pagado</p>
                    <p className="font-bold text-green-700">{fmt(detail.pagadoAcumulado)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">Balance</p>
                    <p className={clsx('font-bold', detail.sobregirado ? 'text-red-600' : 'text-amber-700')}>
                      {fmt(detail.balancePendiente)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Progreso de ejecución</p>
                  <ProgressBar pct={detail.porcentajeEjecutado} sobregirado={detail.sobregirado} />
                </div>
              </div>

              {/* Gastos vinculados */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Gastos Vinculados ({detail.expenses?.length ?? 0})
                  </h3>
                  {canEdit && detail.estado === 'ACTIVO' && (
                    <button
                      onClick={() => setShowVincular(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Link className="w-3.5 h-3.5" /> Vincular Gasto
                    </button>
                  )}
                </div>

                {unlinkError && (
                  <div className="mb-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {unlinkError}
                  </div>
                )}

                {(!detail.expenses || detail.expenses.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    No hay gastos vinculados
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Descripción</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Fecha</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Monto</th>
                          {canEdit && <th className="px-3 py-2" />}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.expenses.map((exp) => (
                          <tr key={exp.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-800">{exp.description}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(exp.expenseDate)}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(exp.amount)}</td>
                            {canEdit && (
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => unlinkMutation.mutate(exp.id)}
                                  disabled={unlinkMutation.isPending}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Desvincular">
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

  // Filtros
  const [search, setSearch]         = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterEstado, setFilterEstado]   = useState('');

  // UI state
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<ContratoAjustado | null>(null);
  const [detailContrato, setDetailContrato] = useState<ContratoAjustado | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleteError, setDeleteError]   = useState('');
  const [expandedResumen, setExpandedResumen] = useState(false);

  const canCreate = isSupervisor || isOperator;
  const canEdit   = isSupervisor;
  const canDelete = role === 'admin';

  // Queries
  const { data: listRes, isLoading, isError } = useQuery({
    queryKey: ['contratos-ajustados', { search, filterProject, filterEstado }],
    queryFn: () =>
      contratosAjustadosApi.list({
        search: search || undefined,
        projectId: filterProject || undefined,
        estado: filterEstado || undefined,
        limit: 100,
      }),
  });

  const { data: resumenRes } = useQuery({
    queryKey: ['contratos-resumen'],
    queryFn: () => contratosAjustadosApi.resumen(),
  });

  const { data: projectsRes } = useQuery({
    queryKey: ['projects-active'],
    queryFn: () => projectsApi.list({ status: 'ACTIVE', limit: 100 }),
  });

  const contratos: ContratoAjustado[] = listRes?.data?.data ?? [];
  const resumen: ContratoResumen | null = resumenRes?.data?.data ?? null;
  const projects = projectsRes?.data?.data ?? [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contratosAjustadosApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contratos-ajustados'] });
      qc.invalidateQueries({ queryKey: ['contratos-resumen'] });
      setDeleteId(null);
    },
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Error al eliminar'),
  });

  const handleEdit = (c: ContratoAjustado) => {
    setDetailContrato(null);
    setEditing(c);
    setShowForm(true);
  };

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <FileCheck className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contratos Ajustados</h1>
            <p className="text-sm text-gray-500">Seguimiento de contratos por suplidor y proyecto</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Contrato
          </button>
        )}
      </div>

      {/* Tarjetas de resumen */}
      {resumen && <ResumenCards resumen={resumen} />}

      {/* Desgloses expandibles */}
      {resumen && (resumen.porProyecto.length > 0 || resumen.porSuplidor.length > 0) && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200">
          <button
            onClick={() => setExpandedResumen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
            <span>Ver desglose por proyecto y suplidor</span>
            {expandedResumen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedResumen && (
            <div className="border-t border-gray-100 p-5 grid md:grid-cols-2 gap-6">
              {/* Por proyecto */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por Proyecto</h4>
                <div className="space-y-2">
                  {resumen.porProyecto.slice(0, 5).map((row) => (
                    <div key={row.project.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1">{row.project.code} · {row.project.name}</span>
                      <span className="text-gray-500 ml-4">{fmt(row.contratado)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Por suplidor */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por Suplidor</h4>
                <div className="space-y-2">
                  {resumen.porSuplidor.slice(0, 5).map((row) => (
                    <div key={row.supplier.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1">{row.supplier.name}</span>
                      <span className="text-gray-500 ml-4">{fmt(row.contratado)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción o suplidor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los proyectos</option>
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="COMPLETADO">Completado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-600">Error al cargar los contratos</p>
          </div>
        ) : contratos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileCheck className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hay contratos registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || filterProject || filterEstado
                ? 'Prueba con otros filtros'
                : 'Crea el primer contrato ajustado'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suplidor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Pagado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Balance</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Progreso</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.project?.code}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">{c.project?.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800 truncate max-w-[140px]">{c.supplier?.name}</p>
                      {c.supplier?.rnc && <p className="text-xs text-gray-400">{c.supplier.rnc}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-gray-700 truncate max-w-[200px]">{c.descripcionTrabajo}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {fmt(c.montoContratado)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 hidden md:table-cell whitespace-nowrap">
                      {fmt(c.pagadoAcumulado)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                      <span className={clsx('font-medium', c.sobregirado ? 'text-red-600' : 'text-amber-700')}>
                        {fmt(c.balancePendiente)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell w-36">
                      <ProgressBar pct={c.porcentajeEjecutado} sobregirado={c.sobregirado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium w-fit', ESTADO_CFG[c.estado].cls)}>
                          {ESTADO_CFG[c.estado].label}
                        </span>
                        {c.sobregirado && (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertTriangle className="w-3 h-3" /> Sobregirado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setDetailContrato(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                          title="Ver detalle">
                          <FileCheck className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(c)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors"
                            title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => { setDeleteId(c.id); setDeleteError(''); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Eliminar">
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
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Eliminar Contrato</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de que deseas eliminar este contrato? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
