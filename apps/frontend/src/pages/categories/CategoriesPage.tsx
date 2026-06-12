import { useState } from 'react';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Tag, Plus, Edit, X, CheckCircle, AlertCircle, Lock,
} from 'lucide-react';
import { categoriesApi } from '../../api';
import { useRole } from '../../hooks/useRole';

type CatForm = { name: string; description?: string; icon?: string };

const ICON_OPTIONS = ['🏗️','🔧','⚡','💧','🪟','🛗','🛡️','🚛','📐','🧱','🪣','💡','🔩','🪚','📦','🌿'];

export default function CategoriesPage() {
  const qc   = useQueryClient();
  const { isAdmin } = useRole();

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
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div className="bg-[#1C1C1C]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-[#F5C218] uppercase mb-2">
            ADMINISTRACIÓN / CATEGORÍAS
          </p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight leading-none">
                CATEGORÍAS
              </h1>
              <p className="font-['DM_Sans'] text-sm text-gray-400 mt-3">
                {categories?.length ?? 0} categorías disponibles
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Nueva categoría
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {apiOk && (
          <div className="flex items-center gap-2 bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218] p-3 text-sm font-['DM_Sans']">
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
                <div className="w-5 h-5 bg-[#1C1C1C] border border-white/20 flex items-center justify-center">
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
                  <div className="w-5 h-5 bg-[#F5C218] flex items-center justify-center">
                    <Tag className="w-3 h-3 text-[#1C1C1C]" />
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
                        ${isAdmin ? 'cursor-pointer hover:border-[#F5C218] hover:shadow-[0_2px_12px_rgba(245,194,24,0.15)]' : ''}`}
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
              <div className="bg-[#1C1C1C] border border-white/10 p-12 text-center">
                <Tag className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="font-['DM_Sans'] text-sm text-gray-400">No hay categorías personalizadas</p>
                <button
                  onClick={openCreate}
                  className="mt-4 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors"
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
            <div className="flex items-center justify-between px-6 py-4 bg-[#1C1C1C]">
              <h3 className="font-['Barlow_Condensed'] text-lg font-semibold text-white uppercase tracking-wide">
                {modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-[#F5C218] transition-colors"
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
                  className={`w-full font-['DM_Sans'] text-sm border text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
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
                  className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
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
                          ? 'bg-[#F5C218]/10 border-[#F5C218]'
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

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 font-['DM_Sans'] text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPending
                    ? <><span className="w-4 h-4 border-2 border-[#1C1C1C] border-t-transparent rounded-full animate-spin" /> Guardando...</>
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
