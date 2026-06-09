import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Users, UserPlus, Edit, X, CheckCircle, AlertCircle,
  ShieldCheck, Copy, Clock, Mail, Trash2, MessageCircle,
} from 'lucide-react';
import { usersApi } from '../../api';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EditForm = { name: string; email: string; phone?: string; roleId: string };
type InviteForm = { email: string; roleId: string };

const ROLE_BADGE: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  supervisor: 'bg-blue-100 text-blue-700',
  operator:   'bg-gray-100 text-gray-600',
};
const ROLE_LABEL: Record<string, string> = {
  admin:      'Administrador',
  supervisor: 'Supervisor',
  operator:   'Operador',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc   = useQueryClient();
  const self = useAuthStore((s) => s.user);
  const isAdmin = self?.role?.name === 'admin';
  const canManage = self?.role?.name === 'admin' || self?.role?.name === 'supervisor';

  const [modal,       setModal]       = useState<'invite' | 'edit' | null>(null);
  const [editing,     setEditing]     = useState<any>(null);
  const [apiError,    setApiError]    = useState('');
  const [apiOk,       setApiOk]       = useState('');
  const [inviteLink,  setInviteLink]  = useState('');
  const [copied,      setCopied]      = useState(false);

  const editForm   = useForm<EditForm>();
  const inviteForm = useForm<InviteForm>();

  // ── Queries ──
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list(),
    select:   (r) => r.data.data,
  });

  const FALLBACK_ROLES = [
    { id: 1, name: 'admin' },
    { id: 2, name: 'supervisor' },
    { id: 3, name: 'operator' },
  ];

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => usersApi.roles(),
    select:   (r) => r.data?.data ?? [],
    retry:    1,
  });

  const roles = (rolesData && rolesData.length > 0) ? rolesData : FALLBACK_ROLES;

  const { data: pendingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ['invitations'],
    queryFn:  () => api.get('/invitations'),
    select:   (r) => r.data.data,
    enabled:  canManage,
  });

  // ── Mutations ──
  const inviteMutation = useMutation({
    mutationFn: (data: any) => api.post('/invitations', data),
    onSuccess: (res) => {
      refetchInvites();
      const d = res.data.data;
      setInviteLink(d.inviteUrl);
      if (d.emailSent) {
        setApiOk(`Invitación enviada a ${d.email}`);
      } else if (!d.emailConfigured) {
        setApiOk(`Invitación creada. Email no configurado — comparte el enlace manualmente.`);
      } else {
        setApiOk(`Invitación creada, pero falló el envío${d.emailError ? `: ${d.emailError}` : ''}. Comparte el enlace manualmente.`);
      }
    },
    onError: (err: any) => setApiError(err.response?.data?.error || 'Error al invitar'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setApiOk('Usuario actualizado');
      closeModal();
    },
    onError: (err: any) => setApiError(err.response?.data?.error || 'Error'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError:   (err: any) => setApiError(err.response?.data?.error || 'Error'),
  });

  const whatsappToggle = useMutation({
    mutationFn: ({ id, whatsappOptIn }: { id: string; whatsappOptIn: boolean }) =>
      usersApi.update(id, { whatsappOptIn }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError:   (err: any) => setApiError(err.response?.data?.error || 'Error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`),
    onSuccess:  () => refetchInvites(),
    onError:    (err: any) => setApiError(err.response?.data?.error || 'Error'),
  });

  // ── Helpers ──
  function openEdit(u: any) {
    setEditing(u);
    setApiError('');
    editForm.reset({
      name: u.name, email: u.email, phone: u.phone ?? '', roleId: u.role?.id?.toString() ?? '',
    });
    setModal('edit');
  }

  function openInvite() {
    setApiError(''); setApiOk(''); setInviteLink('');
    inviteForm.reset({ email: '', roleId: '' });
    setModal('invite');
  }

  function closeModal() {
    setModal(null); setEditing(null);
    setApiError(''); setInviteLink('');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const onInviteSubmit = (data: InviteForm) => {
    setApiError('');
    inviteMutation.mutate({ email: data.email, roleId: Number(data.roleId) });
  };

  const onEditSubmit = (data: EditForm) => {
    setApiError('');
    updateMutation.mutate({
      id: editing.id,
      data: { name: data.name, email: data.email, phone: data.phone || undefined, roleId: Number(data.roleId) },
    });
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="module-label">ADMINISTRACIÓN / USUARIOS</p>
          <h1 className="page-title">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users?.length ?? 0} usuarios activos</p>
        </div>
        {canManage && (
          <button onClick={openInvite} className="smi-btn">
            <UserPlus className="w-4 h-4" /> Invitar usuario
          </button>
        )}
      </div>

      {/* Feedback global */}
      {apiOk && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{apiOk}</span>
            {inviteLink && (
              <div className="mt-2 bg-white border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <span className="text-xs text-gray-600 truncate flex-1 font-mono">{inviteLink}</span>
                <button onClick={copyLink}
                  className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1 shrink-0">
                  <Copy className="w-3 h-3" /> {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setApiOk(''); setInviteLink(''); }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {apiError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
          <button onClick={() => setApiError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Lista de usuarios */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando usuarios...</div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {(users ?? []).map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-700">{u.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  {u.id === self?.id && <span className="text-xs text-gray-400">(tú)</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role?.name] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[u.role?.name] ?? u.role?.name}
                  </span>
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactivo</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>

              {isAdmin && u.id !== self?.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    title={u.whatsappOptIn ? 'WhatsApp activo — click para desactivar' : 'Activar notificaciones WhatsApp'}
                    onClick={() => whatsappToggle.mutate({ id: u.id, whatsappOptIn: !u.whatsappOptIn })}
                    className={`p-1.5 rounded-lg transition-colors ${u.whatsappOptIn ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}>
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
                      ${u.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => openEdit(u)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invitaciones pendientes */}
      {canManage && (pendingInvites ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Invitaciones pendientes
          </p>
          <div className="card divide-y divide-gray-50">
            {(pendingInvites ?? []).map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    {ROLE_LABEL[inv.role?.name] ?? inv.role?.name} · Expira {new Date(inv.expiresAt).toLocaleDateString('es-DO')}
                    {inv.invitedBy && ` · Invitado por ${inv.invitedBy.name}`}
                  </p>
                </div>
                <button onClick={() => revokeMutation.mutate(inv.id.toString())}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota de roles */}
      <div className="card p-4 flex items-start gap-3 bg-blue-50 border border-blue-100">
        <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-600 space-y-1">
          <p><strong>Admin:</strong> acceso total, gestión de usuarios y categorías.</p>
          <p><strong>Supervisor:</strong> crea/edita proyectos, anula gastos, puede invitar usuarios.</p>
          <p><strong>Operador:</strong> registra gastos y los edita dentro de las primeras 24 horas.</p>
        </div>
      </div>

      {/* ── Modal Invitar ── */}
      {modal === 'invite' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary-600" /> Invitar nuevo usuario
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                </div>
              )}
              <p className="text-sm text-gray-600">
                Se enviará un correo con un enlace de activación. El usuario podrá crear su propia contraseña.
              </p>
              <div>
                <label className="label">Correo electrónico *</label>
                <input type="email" className={`input-field ${inviteForm.formState.errors.email ? 'input-error' : ''}`}
                  placeholder="correo@empresa.com"
                  {...inviteForm.register('email', { required: 'El correo es requerido' })} />
                {inviteForm.formState.errors.email && (
                  <p className="text-red-500 text-xs mt-1">{inviteForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className={`input-field ${inviteForm.formState.errors.roleId ? 'input-error' : ''}`}
                  {...inviteForm.register('roleId', { required: 'Selecciona un rol' })}>
                  <option value="">— Selecciona un rol —</option>
                  {(roles ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
                  ))}
                </select>
                {inviteForm.formState.errors.roleId && (
                  <p className="text-red-500 text-xs mt-1">{inviteForm.formState.errors.roleId.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={inviteMutation.isPending} className="btn-primary flex-1">
                  {inviteMutation.isPending
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                    : <><Mail className="w-4 h-4" /> Enviar invitación</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Editar ── */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Editar usuario</h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{apiError}</span>
                </div>
              )}
              <div>
                <label className="label">Nombre *</label>
                <input className={`input-field ${editForm.formState.errors.name ? 'input-error' : ''}`}
                  {...editForm.register('name', { required: 'Requerido' })} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className={`input-field ${editForm.formState.errors.email ? 'input-error' : ''}`}
                  {...editForm.register('email', { required: 'Requerido' })} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input-field" {...editForm.register('phone')} />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="input-field"
                  {...editForm.register('roleId', { required: 'Requerido' })}>
                  <option value="">— Rol —</option>
                  {(roles ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1">
                  {updateMutation.isPending
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
