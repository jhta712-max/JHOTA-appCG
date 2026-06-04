import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Bell, Plus, Edit, Trash2, X, CheckCircle, AlertCircle,
  Phone, Mail, User, Send, RefreshCw,
} from 'lucide-react';
import { notificationContactsApi, notificationsApi } from '../../api';
import type { NotificationContact } from '../../types';

type ContactForm = { name: string; phone?: string; email?: string };

export default function NotificationContactsPage() {
  const qc = useQueryClient();
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [editing,  setEditing]  = useState<NotificationContact | null>(null);
  const [apiError, setApiError] = useState('');
  const [apiOk,    setApiOk]    = useState('');

  const form = useForm<ContactForm>();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['notification-contacts'],
    queryFn:  () => notificationContactsApi.list(),
    select:   (r) => r.data.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContactForm) =>
      notificationContactsApi.create({ name: data.name, phone: data.phone || null, email: data.email || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-contacts'] });
      setApiOk('Contacto creado');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error ?? 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactForm }) =>
      notificationContactsApi.update(id, { name: data.name, phone: data.phone || null, email: data.email || null }),
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
    form.reset({ name: '', phone: '', email: '' });
    setModal('create');
  }

  function openEdit(c: NotificationContact) {
    setEditing(c);
    setApiError('');
    form.reset({ name: c.name, phone: c.phone ?? '', email: c.email ?? '' });
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setApiError('');
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
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" /> Contactos de Notificación
          </h1>
          <p className="text-sm text-gray-500">
            Personas externas que reciben alertas por WhatsApp y/o email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => testWhatsAppMutation.mutate()}
            disabled={testWhatsAppMutation.isPending}
            title="Enviar WhatsApp de prueba a todos los destinatarios configurados"
            className="btn-secondary text-sm">
            {testWhatsAppMutation.isPending
              ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />}
            Probar WhatsApp
          </button>
          <button
            onClick={() => runChecksMutation.mutate()}
            disabled={runChecksMutation.isPending}
            title="Ejecutar revisión de alertas ahora (presupuesto, órdenes, nóminas)"
            className="btn-secondary text-sm">
            {runChecksMutation.isPending
              ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            Ejecutar alertas
          </button>
          <button onClick={openCreate} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Agregar contacto
          </button>
        </div>
      </div>

      {/* Feedback */}
      {apiOk && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiOk}</span>
          <button onClick={() => setApiOk('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {apiError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{apiError}</span>
          <button onClick={() => setApiError('')}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Info box */}
      <div className="card p-4 bg-blue-50 border border-blue-100 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">¿Cómo funcionan los contactos externos?</p>
        <p>Los contactos con <strong>teléfono</strong> recibirán alertas por WhatsApp (requiere Twilio configurado).</p>
        <p>Los contactos con <strong>email</strong> recibirán los mismos avisos por correo que los administradores.</p>
        <p>Los usuarios del sistema también pueden optar por WhatsApp desde la página de <strong>Usuarios</strong>.</p>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando contactos...</div>
      ) : (contacts ?? []).length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay contactos externos aún</p>
          <p className="text-sm text-gray-400 mt-1">Agrega personas que deben recibir las alertas automáticas</p>
          <button onClick={openCreate} className="btn-primary text-sm mt-4">
            <Plus className="w-4 h-4" /> Agregar contacto
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {(contacts ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {!c.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactivo</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {c.phone && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {c.email}
                    </span>
                  )}
                  {!c.phone && !c.email && (
                    <span className="text-xs text-amber-500">Sin teléfono ni email</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                    ${c.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                  {c.isActive ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => openEdit(c)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteMutation.mutate(c.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {modal === 'create' ? 'Agregar contacto' : 'Editar contacto'}
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                </div>
              )}
              <div>
                <label className="label">Nombre *</label>
                <input className={`input-field ${form.formState.errors.name ? 'input-error' : ''}`}
                  placeholder="Nombre completo"
                  {...form.register('name', { required: 'El nombre es requerido' })} />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="label">Teléfono (WhatsApp)</label>
                <input className="input-field" placeholder="+1809XXXXXXX"
                  {...form.register('phone')} />
                <p className="text-xs text-gray-400 mt-1">Incluye el código de país. Ej: +18095551234</p>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" placeholder="nombre@empresa.com"
                  {...form.register('email')} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1">
                  {isPending
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
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
