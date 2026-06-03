import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmtDate } from '../../utils/date';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, AlertCircle, Plus, Trash2, Pencil, Check, X, FileText, Users, UserPlus,
} from 'lucide-react';
import { projectsApi, usersApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import type { Addendum } from '../../types';

// ── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

type FormData = {
  code: string; name: string; client: string; location: string;
  startDate: string; endDate: string; estimatedBudget: number;
  status: string; notes: string;
};

type AddendumForm = { amount: string; description: string; date: string };

// ── Fila de adenda (modo vista o edición inline) ───────────────
function AddendumRow({
  addendum,
  onSave,
  onDelete,
}: {
  addendum: Addendum;
  onSave: (id: string, data: AddendumForm) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState<AddendumForm>({
    amount:      String(addendum.amount),
    description: addendum.description,
    date:        addendum.date?.split('T')[0] ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(addendum.id, form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <tr className="bg-yellow-50">
        <td className="px-3 py-2 text-sm font-medium text-gray-600">#{addendum.number}</td>
        <td className="px-3 py-2">
          <input
            type="number" min="0.01" step="0.01"
            className="input-field text-sm py-1.5"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <input
            className="input-field text-sm py-1.5"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="date" className="input-field text-sm py-1.5"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={saving}
              className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditing(false)}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2.5 text-sm font-semibold text-gray-500">#{addendum.number}</td>
      <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{fmt(addendum.amount)}</td>
      <td className="px-3 py-2.5 text-sm text-gray-700">{addendum.description}</td>
      <td className="px-3 py-2.5 text-sm text-gray-500">
        {fmtDate(addendum.date)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(addendum.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function ProjectFormPage() {
  const { id }   = useParams<{ id: string }>();
  const isEdit   = !!id;
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const user     = useAuthStore((s) => s.user);
  const canEdit  = user?.role?.name === 'admin' || user?.role?.name === 'supervisor';

  // Formulario del proyecto
  const { data: existing } = useQuery({
    queryKey: ['project', id],
    queryFn:  () => projectsApi.getById(id!),
    select:   (r) => r.data.data,
    enabled:  isEdit,
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>();
  const estimatedBudget = Number(watch('estimatedBudget') ?? 0);

  useEffect(() => {
    if (existing) {
      reset({
        code:            existing.code,
        name:            existing.name,
        client:          existing.client ?? '',
        location:        existing.location ?? '',
        startDate:       existing.startDate?.split('T')[0],
        endDate:         existing.endDate?.split('T')[0] ?? '',
        estimatedBudget: Number(existing.estimatedBudget),
        status:          existing.status,
        notes:           existing.notes ?? '',
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      console.log('[ProjectForm] Enviando datos:', data);
      return isEdit ? projectsApi.update(id!, data) : projectsApi.create(data);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${res.data.data.id}`);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      estimatedBudget: Number(data.estimatedBudget),
      endDate:  data.endDate  || undefined,
      client:   data.client   || undefined,
      location: data.location || undefined,
      notes:    data.notes    || undefined,
    });
  };

  // ── Adendas ────────────────────────────────────────────────
  const { data: addendums = [], refetch: refetchAddendums } = useQuery({
    queryKey: ['addendums', id],
    queryFn:  () => projectsApi.getAddendums(id!),
    select:   (r) => r.data.data,
    enabled:  isEdit,
  });

  const addendumTotal = addendums.reduce((s, a) => s + a.amount, 0);
  const totalBudget   = estimatedBudget + addendumTotal;

  // Formulario inline para nueva adenda
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<AddendumForm>({ amount: '', description: '', date: '' });
  const [newError, setNewError] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const handleCreateAddendum = async () => {
    if (!newForm.amount || !newForm.description || !newForm.date) {
      setNewError('Todos los campos son requeridos');
      return;
    }
    if (Number(newForm.amount) <= 0) {
      setNewError('El monto debe ser mayor a 0');
      return;
    }
    setSavingNew(true);
    setNewError('');
    try {
      await projectsApi.createAddendum(id!, {
        amount:      Number(newForm.amount),
        description: newForm.description,
        date:        newForm.date,
      });
      setNewForm({ amount: '', description: '', date: '' });
      setShowNewForm(false);
      refetchAddendums();
      qc.invalidateQueries({ queryKey: ['project-summary', id] });
    } catch (err: any) {
      setNewError(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdateAddendum = async (addendumId: string, data: AddendumForm) => {
    await projectsApi.updateAddendum(id!, addendumId, {
      amount:      Number(data.amount),
      description: data.description,
      date:        data.date,
    });
    refetchAddendums();
    qc.invalidateQueries({ queryKey: ['project-summary', id] });
  };

  const handleDeleteAddendum = async (addendumId: string) => {
    if (!confirm('¿Eliminar esta adenda? El presupuesto total se ajustará automáticamente.')) return;
    await projectsApi.deleteAddendum(id!, addendumId);
    refetchAddendums();
    qc.invalidateQueries({ queryKey: ['project-summary', id] });
  };

  // ── Asignaciones de equipo ─────────────────────────────────
  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['assignments', id],
    queryFn:  () => projectsApi.getAssignments(id!),
    select:   (r) => r.data.data,
    enabled:  isEdit,
  });

  // Lista de todos los operadores disponibles
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list(),
    select:   (r) => r.data.data.filter((u) => u.role?.name === 'operator' && u.isActive),
    enabled:  isEdit,
  });

  const assignedIds    = new Set(assignments.map((a) => a.userId));
  const availableUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignError, setAssignError]       = useState('');
  const [assignSaving, setAssignSaving]     = useState(false);

  const handleAssign = async () => {
    if (!selectedUserId) { setAssignError('Selecciona un operador'); return; }
    setAssignSaving(true); setAssignError('');
    try {
      await projectsApi.assignUser(id!, selectedUserId);
      setSelectedUserId('');
      refetchAssignments();
      qc.invalidateQueries({ queryKey: ['project', id] });
    } catch (e: any) {
      setAssignError(e.response?.data?.error ?? 'Error al asignar');
    } finally { setAssignSaving(false); }
  };

  const handleUnassign = async (userId: string, userName: string) => {
    if (!confirm(`¿Remover a ${userName} de este proyecto?`)) return;
    await projectsApi.unassignUser(id!, userId);
    refetchAssignments();
    qc.invalidateQueries({ queryKey: ['project', id] });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</h1>
          <p className="text-sm text-gray-500">Completa la información del proyecto</p>
        </div>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{(mutation.error as any)?.response?.data?.error ?? 'Error al guardar'}</p>
            {(mutation.error as any)?.response?.status === 401 && (
              <p className="text-xs text-red-600 mt-1">Tu sesión ha expirado. Por favor, inicia sesión nuevamente.</p>
            )}
            {(mutation.error as any)?.response?.status === 403 && (
              <p className="text-xs text-red-600 mt-1">No tienes permisos para crear proyectos. Se requiere rol de Admin o Supervisor.</p>
            )}
            {(mutation.error as any)?.response?.data?.details && (
              <div className="text-xs text-red-600 mt-2">
                <p className="font-semibold">Errores de validación:</p>
                <ul className="list-disc list-inside">
                  {Object.entries((mutation.error as any).response.data.details).map(([field, errors]: any) => (
                    <li key={field}><strong>{field}:</strong> {Array.isArray(errors) ? errors[0] : errors}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* ── Información básica ─────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Información básica</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Código *</label>
              <input className={`input-field uppercase ${errors.code ? 'input-error' : ''}`}
                placeholder="PROJ-2026-001"
                {...register('code', { required: 'El código es requerido' })} />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Presupuesto base (RD$) *</label>
              <input type="number" min="0" step="0.01"
                className={`input-field ${errors.estimatedBudget ? 'input-error' : ''}`}
                placeholder="500000"
                {...register('estimatedBudget', {
                  required: 'Requerido',
                  min: { value: 0, message: 'Debe ser positivo' },
                })} />
              {errors.estimatedBudget && (
                <p className="text-red-500 text-xs mt-1">{errors.estimatedBudget.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Nombre del proyecto *</label>
            <input className={`input-field ${errors.name ? 'input-error' : ''}`}
              placeholder="Edificio Residencial Las Palmas"
              {...register('name', { required: 'El nombre es requerido' })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente</label>
              <input className="input-field" placeholder="Nombre del cliente" {...register('client')} />
            </div>
            <div>
              <label className="label">Ubicación</label>
              <input className="input-field" placeholder="Ciudad, País" {...register('location')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de inicio *</label>
              <input type="date"
                className={`input-field ${errors.startDate ? 'input-error' : ''}`}
                {...register('startDate', { required: 'La fecha es requerida' })} />
            </div>
            <div>
              <label className="label">Fecha fin estimada</label>
              <input type="date" className="input-field" {...register('endDate')} />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="label">Estado</label>
              <select className="input-field" {...register('status')}>
                <option value="ACTIVE">Activo</option>
                <option value="PAUSED">Pausado</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
          )}

          <div>
            <label className="label">Notas u observaciones</label>
            <textarea rows={3} className="input-field resize-none"
              placeholder="Información adicional sobre el proyecto..."
              {...register('notes')} />
          </div>
        </div>

        {/* ── Adendas de contrato (solo en modo edición) ─────── */}
        {isEdit && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-800">Adendas de contrato</h2>
                {addendums.length > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                    {addendums.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowNewForm(true); setNewError(''); }}
                className="btn-primary text-sm py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar adenda
              </button>
            </div>

            {/* Resumen de presupuesto con adendas */}
            {(estimatedBudget > 0 || addendumTotal > 0) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-sm">
                <div className="flex justify-between items-center px-4 py-2.5 text-gray-600">
                  <span>Presupuesto base</span>
                  <span className="font-medium">{fmt(estimatedBudget)}</span>
                </div>
                {addendums.map((a) => (
                  <div key={a.id} className="flex justify-between items-center px-4 py-2.5 text-gray-600">
                    <span className="truncate pr-4">
                      Adenda #{a.number}{' '}
                      <span className="text-gray-400 text-xs">— {a.description}</span>
                    </span>
                    <span className="font-medium text-green-700 shrink-0">+ {fmt(a.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-3 font-semibold text-gray-900 bg-white rounded-b-lg">
                  <span>Presupuesto total del contrato</span>
                  <span style={{ color: '#D4A017' }}>{fmt(totalBudget)}</span>
                </div>
              </div>
            )}

            {/* Tabla de adendas */}
            {addendums.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2.5 text-left w-10">N°</th>
                      <th className="px-3 py-2.5 text-left">Monto</th>
                      <th className="px-3 py-2.5 text-left">Descripción</th>
                      <th className="px-3 py-2.5 text-left">Fecha</th>
                      <th className="px-3 py-2.5 text-left w-20">Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addendums.map((a) => (
                      <AddendumRow
                        key={a.id}
                        addendum={a}
                        onSave={handleUpdateAddendum}
                        onDelete={handleDeleteAddendum}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {addendums.length === 0 && !showNewForm && (
              <p className="text-sm text-gray-400 text-center py-3">
                No hay adendas registradas. Agrégalas si el contrato fue ampliado.
              </p>
            )}

            {/* Formulario nueva adenda inline */}
            {showNewForm && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">
                  Nueva adenda #{addendums.length + 1}
                </p>
                {newError && (
                  <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {newError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Monto adicional (RD$) *</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      className="input-field"
                      placeholder="250000"
                      value={newForm.amount}
                      onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha de la adenda *</label>
                    <input
                      type="date" className="input-field"
                      value={newForm.date}
                      onChange={(e) => setNewForm({ ...newForm, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Descripción / concepto *</label>
                  <input
                    className="input-field"
                    placeholder="Ej. Ampliación de alcance — Fase 2"
                    value={newForm.description}
                    onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setNewError(''); }}
                    className="btn-secondary flex-1 py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAddendum}
                    disabled={savingNew}
                    className="btn-primary flex-1 py-2"
                  >
                    {savingNew
                      ? <><span className="w-3.5 h-3.5 border-2 border-gray-700/40 border-t-gray-900 rounded-full animate-spin" /> Guardando...</>
                      : <><Check className="w-4 h-4" /> Guardar adenda</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Equipo asignado (solo en modo edición) ───────────────── */}
        {isEdit && canEdit && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Equipo asignado</h2>
              {assignments.length > 0 && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                  {assignments.length}
                </span>
              )}
            </div>

            {/* Lista de operadores asignados */}
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay operadores asignados a este proyecto.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
                        {a.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{a.user.name}</p>
                        <p className="text-xs text-gray-400">{a.user.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a.userId, a.user.name)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                      title="Quitar del proyecto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Asignar nuevo operador */}
            {availableUsers.length > 0 && (
              <div className="flex gap-2 pt-1">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  <option value="">— Seleccionar operador —</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={!selectedUserId || assignSaving}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {assignSaving
                    ? <span className="w-3.5 h-3.5 border-2 border-gray-700/40 border-t-gray-900 rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />
                  }
                  Asignar
                </button>
              </div>
            )}

            {assignError && (
              <p className="text-xs text-red-500">{assignError}</p>
            )}
          </div>
        )}

        {/* Nota si es creación nueva */}
        {!isEdit && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Las adendas de contrato y el equipo asignado se podrán configurar después de crear el proyecto,
              desde la opción de editar.
            </p>
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 py-3">
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" /> Guardando...</>
              : <><Save className="w-4 h-4" /> {isEdit ? 'Guardar cambios' : 'Crear proyecto'}</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
