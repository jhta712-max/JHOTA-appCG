import { useState } from 'react';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Tag, Plus, Edit, X, CheckCircle, AlertCircle, Lock, GitMerge,
} from 'lucide-react';
import { categoriesApi } from '../../api';
import { useRole } from '../../hooks/useRole';

type CatForm = { name: string; description?: string; icon?: string };

const ICON_OPTIONS = ['🏗️','🔧','⚡','💧','🪟','🛗','🛡️','🚛','📐','🧱','🪣','💡','🔩','🪚','📦','🌿'];

export default function CategoriesPage() {
  const qc   = useQueryClient();
  const { isAdmin } = useRole();

  const [modal,      setModal]      = useState<'create' | 'edit' | null>(null);
  const [editing,    setEditing]    = useState<any>(null);
  const [apiError,   setApiError]   = useState('');
  const [apiOk,      setApiOk]      = useState('');
  const [mergeMode,  setMergeMode]  = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');

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
    setMergeMode(false);
    setMergeTarget('');
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

  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      categoriesApi.merge(sourceId, targetId),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setApiOk(`Categoría "${res.data.data.merged}" fusionada con "${res.data.data.into}"`);
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error || 'Error al fusionar'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending || mergeMutation.isPending;
  const systemCats  = (categories ?? []).filter((c: any) => c.isSystem);
  const customCats  = (categories ?? []).filter((c: any) => !c.isSystem);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div className="bg-[#0D1B48] px-4 md:px-6 py-4 md:py-5">
        <div className="max-w-4xl mx-auto">
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-[#1D4ED8] uppercase mb-2">
            ADMINISTRACIÓN / CATEGORÍAS
          </p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-['Barlow_Condensed'] text-3xl md:text-5xl font-bold text-white uppercase tracking-tight leading-none">
                CATEGORÍAS
              </h1>
              <p className="font-['DM_Sans'] text-sm text-gray-400 mt-3">
                {categories?.length ?? 0} categorías disponibles
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-[#1D4ED8] text-[#0D1B48] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Nueva categoría
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {apiOk && (
          <div className="flex items-center gap-2 bg-[#0D1B48] border border-[#1D4ED8]/40 text-[#1D4ED8] p-3 text-sm font-['DM_Sans']">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiOk}</span>
            <button onClick={() => setApiOk('')}><X className="w-3 h-3" /></button>
          </div>
        )}

        {isLoading ? (
          <ProjectListSkeleton />
        ) : (
          <>
            {/* Categorías del sistema */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-5 bg-[#0D1B48] border border-white/20 flex items-center justify-center">
                  <Lock className="w-3 h-3 text-gray-400" />
                </div>
                <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
                  CATEGORÍAS DEL SISTEMA
                </p>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {systemCats.map((c: any) => (
                  <div
                    key={c.id}
                    className="bg-white border border-gray-200 p-3 flex items-center gap-2 opacity-60 cursor-default"
                  >
                    {c.icon && <span className="text-xl">{c.icon}</span>}
                    <div className="min-w-0">
                      <p className="font-['DM_Sans'] text-sm font-medium text-gray-700 truncate">{c.name}</p>
                      <p className="font-['Space_Mono'] text-xs text-gray-400">sistema</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categorías personalizadas */}
            {customCats.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-5 h-5 bg-[#1D4ED8] flex items-center justify-center">
                    <Tag className="w-3 h-3 text-[#0D1B48]" />
                  </div>
                  <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-gray-500 uppercase">
                    CATEGORÍAS PERSONALIZADAS
                  </p>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {customCats.map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => isAdmin && openEdit(c)}
                      className={`bg-white border border-gray-200 p-3 flex items-center gap-2 transition-all
                        ${isAdmin ? 'cursor-pointer hover:border-[#1D4ED8] hover:shadow-[0_2px_12px_rgba(245,194,24,0.15)]' : ''}`}
                    >
                      {c.icon && <span className="text-xl">{c.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="font-['DM_Sans'] text-sm font-medium text-gray-800 truncate">{c.name}</p>
                        {c.description && (
                          <p className="font-['DM_Sans'] text-xs text-gray-400 truncate">{c.description}</p>
                        )}
                      </div>
                      {isAdmin && <Edit className="w-3 h-3 text-gray-300 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customCats.length === 0 && isAdmin && (
              <div className="bg-[#0D1B48] border border-white/10 p-12 text-center">
                <Tag className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="font-['DM_Sans'] text-sm text-gray-400">No hay categorías personalizadas</p>
                <button
                  onClick={openCreate}
                  className="mt-4 bg-[#1D4ED8] text-[#0D1B48] px-4 py-2 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors"
                >
                  Crear primera categoría
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md shadow-2xl">
            {/* Modal header — dark band */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0D1B48]">
              <h3 className="font-['Barlow_Condensed'] text-lg font-semibold text-white uppercase tracking-wide">
                {modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-[#1D4ED8] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 text-sm font-['DM_Sans']">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Nombre *
                </label>
                <input
                  className={`w-full font-['DM_Sans'] text-sm border text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="Ej: Equipos Pesados"
                  {...register('name', { required: 'El nombre es requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })}
                />
                {errors.name && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Descripción
                </label>
                <input
                  className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                  placeholder="Descripción opcional"
                  {...register('description')}
                />
              </div>

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-2">
                  Ícono
                </label>
                <div className="grid grid-cols-8 gap-1.5 mb-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setValue('icon', watchedIcon === icon ? '' : icon)}
                      className={`text-xl p-1.5 transition-all text-center border
                        ${watchedIcon === icon
                          ? 'bg-[#1D4ED8]/10 border-[#1D4ED8]'
                          : 'border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                {watchedIcon && (
                  <p className="font-['DM_Sans'] text-xs text-gray-500">Seleccionado: {watchedIcon}</p>
                )}
              </div>

              {modal === 'edit' && (
                <div className="border-t border-gray-100 pt-4">
                  {!mergeMode ? (
                    <button
                      type="button"
                      onClick={() => { setMergeMode(true); setApiError(''); }}
                      className="flex items-center gap-2 text-gray-400 hover:text-red-600 font-['DM_Sans'] text-xs transition-colors"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Fusionar con otra categoría...
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-red-600 uppercase">
                        Fusionar — todos los gastos pasarán a la categoría destino y esta se eliminará
                      </p>
                      <select
                        value={mergeTarget}
                        onChange={e => setMergeTarget(e.target.value)}
                        className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#0D1B48] px-3 py-2 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                      >
                        <option value="">— Seleccionar categoría destino —</option>
                        {(categories ?? [])
                          .filter((c: any) => c.id !== editing?.id)
                          .map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}{c.isSystem ? ' (sistema)' : ''}</option>
                          ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setMergeMode(false); setMergeTarget(''); setApiError(''); }}
                          className="flex-1 border border-gray-200 text-gray-600 px-3 py-2 font-['DM_Sans'] text-xs font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancelar fusión
                        </button>
                        <button
                          type="button"
                          disabled={!mergeTarget || mergeMutation.isPending}
                          onClick={() => mergeMutation.mutate({ sourceId: editing.id, targetId: Number(mergeTarget) })}
                          className="flex-1 bg-red-600 text-white px-3 py-2 font-['DM_Sans'] text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {mergeMutation.isPending
                            ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Fusionando...</>
                            : <><GitMerge className="w-3 h-3" /> Confirmar fusión</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 font-['DM_Sans'] text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                {!mergeMode && (
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 bg-[#1D4ED8] text-[#0D1B48] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPending
                      ? <><span className="w-4 h-4 border-2 border-[#0D1B48] border-t-transparent rounded-full animate-spin" /> Guardando...</>
                      : <><CheckCircle className="w-4 h-4" /> {modal === 'create' ? 'Crear' : 'Guardar'}</>
                    }
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
