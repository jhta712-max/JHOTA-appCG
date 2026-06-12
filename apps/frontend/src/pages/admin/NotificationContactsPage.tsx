import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Bell, Plus, Edit, Trash2, X, CheckCircle, AlertCircle,
  Phone, Mail, User, Send, RefreshCw,
} from 'lucide-react';
import { notificationContactsApi, notificationsApi } from '../../api';
import { ProjectListSkeleton } from '../../components/ui/ProjectListSkeleton';
import type { NotificationContact } from '../../types';

// ── Notification type definitions ──────────────────────────────────────────────

const NOTIF_TYPE_OPTIONS = [
  { value: 'BUDGET',           label: 'Alertas de presupuesto',        desc: 'Proyectos al 80%/90% del presupuesto' },
  { value: 'PAYROLL',          label: 'Nóminas sin pagar',             desc: 'Nóminas aprobadas +3 días sin pagar' },
  { value: 'ORDERS',           label: 'Órdenes pendientes',            desc: 'Órdenes de pago +5 días sin ejecutar' },
  { value: 'SERVICE_PAYMENTS', label: 'Pagos de suscripciones',        desc: 'Servicios próximos a vencer' },
  { value: 'SYSTEM',           label: 'Errores del sistema',           desc: 'Alertas críticas del sistema (solo administradores)' },
  { value: 'SECURITY',         label: 'Vulnerabilidades de seguridad', desc: 'Auditoría de dependencias (solo administradores)' },
] as const;

const TYPE_ACCENT: Record<string, { bg: string; text: string }> = {
  BUDGET:           { bg: 'bg-amber-500/20',  text: 'text-amber-400' },
  PAYROLL:          { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  ORDERS:           { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  SERVICE_PAYMENTS: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  SYSTEM:           { bg: 'bg-red-500/20',    text: 'text-red-400' },
  SECURITY:         { bg: 'bg-rose-500/20',   text: 'text-rose-400' },
};

const TYPE_LABEL: Record<string, string> = {
  BUDGET:           'Presupuesto',
  PAYROLL:          'Nóminas',
  ORDERS:           'Órdenes',
  SERVICE_PAYMENTS: 'Suscripciones',
  SYSTEM:           'Sistema',
  SECURITY:         'Seguridad',
};

const DEFAULT_NOTIF_TYPES = ['BUDGET', 'PAYROLL', 'ORDERS'];

type ContactForm = { name: string; phone?: string; email?: string };

export default function NotificationContactsPage() {
  const qc = useQueryClient();
  const [modal,       setModal]       = useState<'create' | 'edit' | null>(null);
  const [editing,     setEditing]     = useState<NotificationContact | null>(null);
  const [apiError,    setApiError]    = useState('');
  const [apiOk,       setApiOk]       = useState('');
  const [notifTypes,  setNotifTypes]  = useState<string[]>(DEFAULT_NOTIF_TYPES);

  const form = useForm<ContactForm>();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['notification-contacts'],
    queryFn:  () => notificationContactsApi.list(),
    select:   (r) => r.data.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContactForm) =>
      notificationContactsApi.create({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        notifTypes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-contacts'] });
      setApiOk('Contacto creado');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactForm }) =>
      notificationContactsApi.update(id, {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        notifTypes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-contacts'] });
      setApiOk('Contacto actualizado');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al actualizar'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      notificationContactsApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-contacts'] }),
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationContactsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-contacts'] });
      setApiOk('Contacto eliminado');
    },
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al eliminar'),
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: () => notificationsApi.testWhatsApp(),
    onSuccess: (r) => setApiOk(r.data.message),
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al enviar prueba'),
  });

  const runChecksMutation = useMutation({
    mutationFn: () => notificationsApi.runChecks(),
    onSuccess: (r) => setApiOk(r.data.message),
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al ejecutar revisión'),
  });

  function openCreate() {
    setEditing(null);
    setApiError('');
    setNotifTypes(DEFAULT_NOTIF_TYPES);
    form.reset({ name: '', phone: '', email: '' });
    setModal('create');
  }

  function openEdit(c: NotificationContact) {
    setEditing(c);
    setApiError('');
    setNotifTypes(c.notifTypes ?? []);
    form.reset({ name: c.name, phone: c.phone ?? '', email: c.email ?? '' });
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setApiError('');
  }

  function toggleNotifType(value: string) {
    setNotifTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  const onSubmit = (data: ContactForm) => {
    setApiError('');
    if (modal === 'edit' && editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div className="bg-[#1C1C1C]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.2em] text-[#F5C218] uppercase mb-2">
            ADMINISTRACIÓN / NOTIFICACIONES
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight leading-none">
                CONTACTOS
              </h1>
              <p className="font-['DM_Sans'] text-sm text-gray-400 mt-3">
                Personas externas que reciben alertas por WhatsApp y/o email
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => testWhatsAppMutation.mutate()}
                disabled={testWhatsAppMutation.isPending}
                className="flex items-center gap-2 border border-white/20 text-white px-3 py-2 font-['DM_Sans'] text-sm hover:border-[#F5C218] hover:text-[#F5C218] transition-colors disabled:opacity-50"
              >
                {testWhatsAppMutation.isPending
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />
                }
                Probar WhatsApp
              </button>
              <button
                onClick={() => runChecksMutation.mutate()}
                disabled={runChecksMutation.isPending}
                className="flex items-center gap-2 border border-white/20 text-white px-3 py-2 font-['DM_Sans'] text-sm hover:border-[#F5C218] hover:text-[#F5C218] transition-colors disabled:opacity-50"
              >
                {runChecksMutation.isPending
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                Ejecutar alertas
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar contacto
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Feedback */}
        {apiOk && (
          <div className="flex items-center gap-2 bg-[#1C1C1C] border border-[#F5C218]/40 text-[#F5C218] p-3 font-['DM_Sans'] text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiOk}</span>
            <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {apiError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 font-['DM_Sans'] text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Info panel */}
        <div className="bg-[#1C1C1C] border border-white/10 p-5 flex items-start gap-4">
          <div className="w-8 h-8 bg-[#F5C218]/10 border border-[#F5C218]/30 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-[#F5C218]" />
          </div>
          <div className="font-['DM_Sans'] text-xs text-gray-400 space-y-1">
            <p className="font-['Barlow_Condensed'] text-sm font-semibold text-white uppercase tracking-wide">Cómo funcionan los contactos externos</p>
            <p>Los contactos con <span className="text-white">teléfono</span> reciben alertas por WhatsApp (requiere UltraMsg configurado).</p>
            <p>Los contactos con <span className="text-white">email</span> reciben los mismos avisos por correo que los administradores.</p>
            <p>Si los tipos de alerta están vacíos, el contacto recibe <span className="text-[#F5C218]">todas las alertas</span>.</p>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <ProjectListSkeleton />
        ) : (contacts ?? []).length === 0 ? (
          <div className="bg-[#1C1C1C] border border-white/10 p-14 text-center">
            <Bell className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <p className="font-['DM_Sans'] text-gray-400 font-medium">No hay contactos externos aún</p>
            <p className="font-['DM_Sans'] text-sm text-gray-500 mt-1">Agrega personas que deben recibir las alertas automáticas</p>
            <button
              onClick={openCreate}
              className="mt-5 bg-[#F5C218] text-[#1C1C1C] px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold hover:bg-[#e6b400] transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1.5" /> Agregar contacto
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 divide-y divide-gray-100">
            {(contacts ?? []).map((c) => (
              <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                {/* Avatar */}
                <div className={`w-9 h-9 flex items-center justify-center shrink-0 mt-0.5 ${c.isActive ? 'bg-[#1C1C1C]' : 'bg-gray-100'}`}>
                  <User className={`w-4 h-4 ${c.isActive ? 'text-[#F5C218]' : 'text-gray-400'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-['DM_Sans'] text-sm font-semibold text-gray-900">{c.name}</p>
                    {!c.isActive && (
                      <span className="font-['Space_Mono'] text-xs px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200">
                        INACTIVO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {c.phone && (
                      <span className="font-['Space_Mono'] text-xs text-gray-500 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="font-['DM_Sans'] text-xs text-gray-500 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> {c.email}
                      </span>
                    )}
                    {!c.phone && !c.email && (
                      <span className="font-['DM_Sans'] text-xs text-amber-500">Sin teléfono ni email</span>
                    )}
                  </div>
                  {/* Notification type badges */}
                  {c.notifTypes && c.notifTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {c.notifTypes.map((t) => {
                        const accent = TYPE_ACCENT[t] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400' };
                        return (
                          <span
                            key={t}
                            className={`font-['Space_Mono'] text-xs px-2 py-0.5 ${accent.bg} ${accent.text}`}
                          >
                            {TYPE_LABEL[t] ?? t}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-['DM_Sans'] text-xs text-gray-400 italic mt-1.5">Todas las alertas</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                    className={`font-['DM_Sans'] text-xs px-2.5 py-1.5 border font-medium transition-colors
                      ${c.isActive
                        ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        : 'border-[#F5C218]/40 text-[#F5C218] hover:bg-[#F5C218]/10'
                      }`}
                  >
                    {c.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 text-gray-400 hover:text-[#F5C218] hover:bg-[#F5C218]/10 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1C1C1C] sticky top-0 z-10">
              <h3 className="font-['Barlow_Condensed'] text-lg font-semibold text-white uppercase tracking-wide">
                {modal === 'create' ? 'Agregar contacto' : 'Editar contacto'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-[#F5C218] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 font-['DM_Sans'] text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                </div>
              )}

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Nombre *
                </label>
                <input
                  className={`w-full font-['DM_Sans'] text-sm border text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors ${form.formState.errors.name ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="Nombre completo"
                  {...form.register('name', { required: 'El nombre es requerido' })}
                />
                {form.formState.errors.name && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Teléfono (WhatsApp)
                </label>
                <input
                  className="w-full font-['Space_Mono'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                  placeholder="+1809XXXXXXX"
                  {...form.register('phone')}
                />
                <p className="font-['DM_Sans'] text-xs text-gray-400 mt-1">Incluye el código de país. Ej: +18095551234</p>
              </div>

              <div>
                <label className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full font-['DM_Sans'] text-sm border border-gray-200 text-[#1C1C1C] px-3 py-2 focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218] transition-colors"
                  placeholder="nombre@empresa.com"
                  {...form.register('email')}
                />
              </div>

              {/* Notification types */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-[0.15em] text-gray-500 uppercase">
                    Tipos de alerta
                  </p>
                  <div className="flex-1 border-t border-gray-100" />
                </div>
                <p className="font-['DM_Sans'] text-xs text-gray-400 mb-3">
                  Sin selección = recibe todas las alertas.
                </p>
                <div className="space-y-2">
                  {NOTIF_TYPE_OPTIONS.map((opt) => {
                    const checked = notifTypes.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#F5C218]/40 bg-[#F5C218]/5'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNotifType(opt.value)}
                          className="mt-0.5 accent-[#F5C218]"
                        />
                        <div className="min-w-0">
                          <p className="font-['DM_Sans'] text-sm font-medium text-gray-800">{opt.label}</p>
                          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {notifTypes.length === 0 && (
                  <p className="font-['DM_Sans'] text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-100 px-3 py-2">
                    Sin selección = recibirá todas las alertas (compatibilidad)
                  </p>
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
                    : <><CheckCircle className="w-4 h-4" /> Guardar</>
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
