import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Tag, Plus, Edit, X, CheckCircle, AlertCircle, Lock,
} from 'lucide-react';
import { categoriesApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

type CatForm = { name: string; description?: string; icon?: string };

const ICON_OPTIONS = ['🏗️','🔧','⚡','💧','🪟','🛗','🛡️','🚛','📐','🧱','🪣','💡','🔩','🪚','📦','🌿'];

export default function CategoriesPage() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.name === 'admin';

  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [editing,  setEditing]  = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const [apiOk,    setApiOk]    = useState('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CatForm>();
  const watchedIcon = watch('icon', '');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list(),
    select:   (r) => r.data.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => categoriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setApiOk('Categoría creada');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error || 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => categoriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setApiOk('Categoría actualizada');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error || 'Error al actualizar'),
  });

  function openCreate() {
    setEditing(null);
    setApiError('');
    reset({ name: '', description: '', icon: '' });
    setModal('create');
  }

  function openEdit(c: any) {
    if (c.isSystem) return;
    setEditing(c);
    setApiError('');
    reset({ name: c.name, description: c.description ?? '', icon: c.icon ?? '' });
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setApiError('');
  }

  const onSubmit = (data: CatForm) => {
    setApiError('');
    const payload = {
      name: data.name,
      description: data.description || undefined,
      icon: data.icon || undefined,
    };
    if (modal === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: editing.id, data: payload });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const systemCats  = (categories ?? []).filter((c: any) => c.isSystem);
  const customCats  = (categories ?? []).filter((c: any) => !c.isSystem);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary-600" /> Categorías
          </h1>
          <p className="text-sm text-gray-500">{categories?.length ?? 0} categorías disponibles</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Nueva categoría
          </button>
        )}
      </div>

      {apiOk && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{apiOk}</span>
          <button onClick={() => setApiOk('')} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando categorías...</div>
      ) : (
        <>
          {/* Categorías del sistema */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categorías del sistema</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {systemCats.map((c: any) => (
                <div key={c.id}
                  className="card p-3 flex items-center gap-2 opacity-75 cursor-default">
                  {c.icon && <span className="text-xl">{c.icon}</span>}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">Sistema</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categorías personalizadas */}
          {customCats.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Categorías personalizadas</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {customCats.map((c: any) => (
                  <div key={c.id}
                    onClick={() => isAdmin && openEdit(c)}
                    className={`card p-3 flex items-center gap-2 ${isAdmin ? 'cursor-pointer hover:border-primary-200 hover:shadow-sm' : ''} transition-all`}>
                    {c.icon && <span className="text-xl">{c.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      {c.description && <p className="text-xs text-gray-400 truncate">{c.description}</p>}
                    </div>
                    {isAdmin && <Edit className="w-3 h-3 text-gray-300 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {customCats.length === 0 && isAdmin && (
            <div className="card p-8 text-center">
              <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay categorías personalizadas</p>
              <button onClick={openCreate} className="btn-primary mt-3 text-sm">Crear primera categoría</button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <label className="label">Nombre *</label>
                <input className={`input-field ${errors.name ? 'input-error' : ''}`}
                  placeholder="Ej: Equipos Pesados"
                  {...register('name', { required: 'El nombre es requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="label">Descripción</label>
                <input className="input-field" placeholder="Descripción opcional"
                  {...register('description')} />
              </div>

              <div>
                <label className="label">Ícono</label>
                <div className="grid grid-cols-8 gap-1.5 mb-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button key={icon} type="button"
                      onClick={() => setValue('icon', watchedIcon === icon ? '' : icon)}
                      className={`text-xl p-1.5 rounded-lg transition-all text-center
                        ${watchedIcon === icon ? 'bg-primary-100 ring-2 ring-primary-400' : 'hover:bg-gray-100'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
                {watchedIcon && (
                  <p className="text-xs text-gray-500">Seleccionado: {watchedIcon}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1">
                  {isPending
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
                    : <><CheckCircle className="w-4 h-4" /> {modal === 'create' ? 'Crear' : 'Guardar'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
