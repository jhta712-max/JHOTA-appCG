import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmtDate } from '../../utils/date';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, AlertCircle, Plus, Trash2, Pencil, Check, X, FileText, Users, UserPlus, Layers,
} from 'lucide-react';
import { projectsApi, usersApi } from '../../api';
import { useRole } from '../../hooks/useRole';
import { ErrorAlert } from '../../components/ErrorAlert';
import type { Addendum } from '../../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

type FormData = {
  code: string; name: string; client: string; location: string;
  startDate: string; endDate: string; estimatedBudget: number;
  status: string; notes: string;
};

type AddendumForm = { amount: string; description: string; date: string };

const inputCls = "w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent bg-white";
const labelCls = "block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

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
        <td className="px-3 py-2 font-['Space_Mono'] text-sm font-medium text-gray-600">#{addendum.number}</td>
        <td className="px-3 py-2">
          <input
            type="number" min="0.01" step="0.01"
            className={inputCls + ' text-sm py-1.5 font-[\'Space_Mono\']'}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <input
            className={inputCls + ' text-sm py-1.5'}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="date" className={inputCls + ' text-sm py-1.5'}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={handleSave} disabled={saving}
              className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditing(false)}
              className="p-1.5 bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2.5 font-['Space_Mono'] text-sm font-semibold text-gray-500">#{addendum.number}</td>
      <td className="px-3 py-2.5 font-['Space_Mono'] text-sm font-medium text-gray-900">{fmt(addendum.amount)}</td>
      <td className="px-3 py-2.5 font-['DM_Sans'] text-sm text-gray-700">{addendum.description}</td>
      <td className="px-3 py-2.5 font-['Space_Mono'] text-sm text-gray-500">
        {fmtDate(addendum.date)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(addendum.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ProjectFormPage() {
  const { id }   = useParams<{ id: string }>();
  const isEdit   = !!id;
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { isSupervisor: canEdit } = useRole();
  const [batchesEnabled, setBatchesEnabled] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);

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
      setBatchesEnabled((existing as any).batchesEnabled ?? false);
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
    mutationFn: async (data: any) => {
      const res = isEdit ? await projectsApi.update(id!, data) : await projectsApi.create(data);
      // En creación, habilitar batches si el toggle estaba activo
      if (!isEdit && batchesEnabled) {
        await projectsApi.enableBatches(res.data.data.id);
      }
      return res;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${res.data.data.id}`);
    },
  });

  const handleToggleBatches = async () => {
    if (!isEdit) { setBatchesEnabled((v) => !v); return; }
    setBatchesLoading(true);
    try {
      if (batchesEnabled) {
        await projectsApi.disableBatches(id!);
        setBatchesEnabled(false);
      } else {
        await projectsApi.enableBatches(id!);
        setBatchesEnabled(true);
      }
      qc.invalidateQueries({ queryKey: ['project', id] });
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Error al cambiar la configuración');
    } finally {
      setBatchesLoading(false);
    }
  };

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
    <div className="max-w-2xl mx-auto space-y-0 pb-10">

      {/* Hero header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 md:px-6 py-4 md:py-5 mb-6" style={{ background: '#0D1B48' }}>
        <div className="max-w-2xl flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-[#1D4ED8] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="font-['Barlow_Condensed'] text-xs tracking-[0.2em] uppercase mb-1" style={{ color: '#1D4ED8' }}>
              MÓDULO / PROYECTOS
            </p>
            <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold tracking-tight text-white uppercase">
              {isEdit ? 'Editar Proyecto' : 'Nuevo Proyecto'}
            </h1>
            <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">Completa la información del proyecto</p>
          </div>
        </div>
      </div>

      {mutation.isError && <ErrorAlert error={mutation.error as any} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Información básica */}
        <div className="bg-white border border-gray-100 p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <span className="w-6 h-6 text-xs font-bold flex items-center justify-center" style={{ background: '#1D4ED8', color: '#ffffff' }}>1</span>
            <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">Información básica</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código *</label>
              <input
                className={`${inputCls} uppercase font-['Space_Mono'] ${errors.code ? 'border-red-400' : ''}`}
                placeholder="PROJ-2026-001"
                {...register('code', { required: 'El código es requerido' })} />
              {errors.code && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Presupuesto base (RD$) *</label>
              <input type="number" min="0" step="0.01"
                className={`${inputCls} font-['Space_Mono'] ${errors.estimatedBudget ? 'border-red-400' : ''}`}
                placeholder="500000"
                {...register('estimatedBudget', {
                  required: 'Requerido',
                  min: { value: 0, message: 'Debe ser positivo' },
                })} />
              {errors.estimatedBudget && (
                <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.estimatedBudget.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Nombre del proyecto *</label>
            <input className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              placeholder="Edificio Residencial Las Palmas"
              {...register('name', { required: 'El nombre es requerido' })} />
            {errors.name && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cliente</label>
              <input className={inputCls} placeholder="Nombre del cliente" {...register('client')} />
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input className={inputCls} placeholder="Ciudad, País" {...register('location')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha de inicio *</label>
              <input type="date"
                className={`${inputCls} ${errors.startDate ? 'border-red-400' : ''}`}
                {...register('startDate', { required: 'La fecha es requerida' })} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin estimada</label>
              <input type="date" className={inputCls} {...register('endDate')} />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} {...register('status')}>
                <option value="ACTIVE">Activo</option>
                <option value="PAUSED">Pausado</option>
                <option value="COMPLETED">Completado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
          )}

          {/* Toggle partidas / lotes */}
          <div
            className={`flex items-start gap-4 border p-4 cursor-pointer transition-colors ${batchesEnabled ? 'border-[#1D4ED8] bg-[#0D1B48]' : 'border-gray-200 bg-gray-50'}`}
            onClick={batchesLoading ? undefined : handleToggleBatches}
          >
            <div className={`mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border-2 transition-colors ${batchesEnabled ? 'border-[#1D4ED8] bg-[#1D4ED8]' : 'border-gray-400 bg-white'}`}>
              {batchesEnabled && <Check className="w-3 h-3 text-[#0D1B48]" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 shrink-0 ${batchesEnabled ? 'text-[#1D4ED8]' : 'text-gray-500'}`} />
                <p className={`font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide ${batchesEnabled ? 'text-white' : 'text-gray-800'}`}>
                  Proyecto con partidas / ítems
                </p>
                {batchesLoading && <span className="w-3.5 h-3.5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />}
              </div>
              <p className={`font-['DM_Sans'] text-xs mt-1 ${batchesEnabled ? 'text-gray-400' : 'text-gray-500'}`}>
                Activa esto si el proyecto maneja presupuesto dividido en partidas o lotes de trabajo. Permite vincular pagos a ítems específicos.
              </p>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas u observaciones</label>
            <textarea rows={3} className={inputCls + ' resize-none'}
              placeholder="Información adicional sobre el proyecto..."
              {...register('notes')} />
          </div>
        </div>

        {/* Adendas de contrato (solo en modo edición) */}
        {isEdit && (
          <div className="bg-white border border-gray-100 p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">
                  Adendas de contrato
                </h2>
                {addendums.length > 0 && (
                  <span className="font-['Space_Mono'] text-xs bg-gray-100 text-gray-600 px-2 py-0.5 font-medium">
                    {addendums.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowNewForm(true); setNewError(''); }}
                className="flex items-center gap-1.5 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide px-3 py-1.5 transition-colors"
                style={{ background: '#1D4ED8', color: '#ffffff' }}
              >
                <Plus className="w-3.5 h-3.5" /> Agregar adenda
              </button>
            </div>

            {/* Resumen de presupuesto con adendas */}
            {(estimatedBudget > 0 || addendumTotal > 0) && (
              <div className="border border-gray-200 bg-gray-50 divide-y divide-gray-200 text-sm">
                <div className="flex justify-between items-center px-4 py-2.5 text-gray-600">
                  <span className="font-['DM_Sans']">Presupuesto base</span>
                  <span className="font-['Space_Mono'] font-medium">{fmt(estimatedBudget)}</span>
                </div>
                {addendums.map((a) => (
                  <div key={a.id} className="flex justify-between items-center px-4 py-2.5 text-gray-600">
                    <span className="font-['DM_Sans'] truncate pr-4">
                      Adenda #{a.number}{' '}
                      <span className="text-gray-400 text-xs">— {a.description}</span>
                    </span>
                    <span className="font-['Space_Mono'] font-medium text-green-700 shrink-0">+ {fmt(a.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-3 font-semibold text-gray-900 bg-white border-t border-gray-200">
                  <span className="font-['Barlow_Condensed'] uppercase tracking-wide text-sm">Presupuesto total del contrato</span>
                  <span className="font-['Space_Mono']" style={{ color: '#D4A017' }}>{fmt(totalBudget)}</span>
                </div>
              </div>
            )}

            {/* Tabla de adendas */}
            {addendums.length > 0 && (
              <div className="overflow-x-auto border border-gray-200">
                <table className="w-full text-sm">
                  <thead style={{ background: '#0D1B48' }}>
                    <tr>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-white w-10">N°</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-white">Monto</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-white">Descripción</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-white">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-['Barlow_Condensed'] uppercase tracking-wide text-xs text-white w-20">Acc.</th>
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
              <p className="font-['DM_Sans'] text-sm text-gray-400 text-center py-3">
                No hay adendas registradas. Agrégalas si el contrato fue ampliado.
              </p>
            )}

            {/* Formulario nueva adenda inline */}
            {showNewForm && (
              <div className="border border-yellow-300 bg-yellow-50 p-4 space-y-3">
                <p className="font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide text-gray-700">
                  Nueva adenda #{addendums.length + 1}
                </p>
                {newError && (
                  <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {newError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Monto adicional (RD$) *</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      className={inputCls + ' font-[\'Space_Mono\']'}
                      placeholder="250000"
                      value={newForm.amount}
                      onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de la adenda *</label>
                    <input
                      type="date" className={inputCls}
                      value={newForm.date}
                      onChange={(e) => setNewForm({ ...newForm, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Descripción / concepto *</label>
                  <input
                    className={inputCls}
                    placeholder="Ej. Ampliación de alcance — Fase 2"
                    value={newForm.description}
                    onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setNewError(''); }}
                    className="flex-1 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide py-2 border-2 border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAddendum}
                    disabled={savingNew}
                    className="flex-1 font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-wide py-2 flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#1D4ED8', color: '#ffffff' }}
                  >
                    {savingNew
                      ? <span className="w-3.5 h-3.5 border-2 border-[#0D1B48] border-t-transparent rounded-full animate-spin" />
                      : <Check className="w-4 h-4" />}
                    Guardar adenda
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Equipo asignado (solo en modo edición) */}
        {isEdit && canEdit && (
          <div className="bg-white border border-gray-100 p-4 md:p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="font-['Barlow_Condensed'] text-base font-bold uppercase tracking-wide text-gray-800">
                Equipo asignado
              </h2>
              {assignments.length > 0 && (
                <span className="font-['Space_Mono'] text-xs bg-gray-100 text-gray-600 px-2 py-0.5 font-medium">
                  {assignments.length}
                </span>
              )}
            </div>

            {assignments.length === 0 ? (
              <p className="font-['DM_Sans'] text-sm text-gray-400 italic">No hay operadores asignados a este proyecto.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center text-xs font-bold uppercase"
                        style={{ background: '#0D1B48', color: '#1D4ED8' }}
                      >
                        {a.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-['DM_Sans'] text-sm font-medium text-gray-800">{a.user.name}</p>
                        <p className="font-['DM_Sans'] text-xs text-gray-400">{a.user.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a.userId, a.user.name)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Quitar del proyecto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availableUsers.length > 0 && (
              <div className="flex gap-2 pt-1">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={inputCls + ' flex-1 text-sm'}
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
                  className="font-['Barlow_Condensed'] uppercase text-xs font-bold px-4 py-2 flex items-center gap-1.5 disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: '#1D4ED8', color: '#ffffff' }}
                >
                  {assignSaving
                    ? <span className="w-3.5 h-3.5 border-2 border-[#0D1B48] border-t-transparent rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />
                  }
                  Asignar
                </button>
              </div>
            )}

            {assignError && (
              <p className="font-['DM_Sans'] text-xs text-red-500">{assignError}</p>
            )}
          </div>
        )}

        {/* Nota si es creación nueva */}
        {!isEdit && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-['DM_Sans']">
              Las adendas de contrato y el equipo asignado se podrán configurar después de crear el proyecto,
              desde la opción de editar.
            </p>
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-2.5 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 font-['Barlow_Condensed'] text-sm font-bold uppercase tracking-wide py-3 flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#1D4ED8', color: '#ffffff' }}
          >
            {mutation.isPending
              ? <><span className="w-4 h-4 border-2 border-[#0D1B48] border-t-transparent rounded-full animate-spin" /> Guardando...</>
              : <><Save className="w-4 h-4" /> {isEdit ? 'Guardar cambios' : 'Crear proyecto'}</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
