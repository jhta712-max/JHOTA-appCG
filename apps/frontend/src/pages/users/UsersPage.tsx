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

const inputCls = "w-full border border-gray-300 rounded-none px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:ring-2 focus:ring-[#F5C218] bg-white";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 font-['Barlow_Condensed'] mb-1";

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

      {/* Hero header */}
      <div className="px-5 py-6" style={{ background: '#1C1C1C' }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-400 mb-1">
              ADMINISTRACIÓN / USUARIOS
            </p>
            <h1 className="font-['Barlow_Condensed'] uppercase tracking-wide text-3xl text-white">
              Usuarios
            </h1>
            <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
              {users?.length ?? 0} usuarios registrados
            </p>
          </div>
          {canManage && (
            <button
              onClick={openInvite}
              className="flex items-center gap-2 px-4 py-2.5 font-['Barlow_Condensed'] uppercase tracking-wide text-sm font-bold shrink-0"
              style={{ background: '#F5C218', color: '#1C1C1C' }}
            >
              <UserPlus className="w-4 h-4" /> Invitar usuario
            </button>
          )}
        </div>
      </div>

      {/* Success */}
      {apiOk && (
        <div className="border-l-4 border-green-500 bg-green-50 px-4 py-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-['DM_Sans'] text-sm text-green-700">{apiOk}</span>
            {inviteLink && (
              <div className="mt-2 bg-white border border-green-200 px-3 py-2 flex items-center gap-2">
                <span className="font-['Space_Mono'] text-xs text-gray-600 truncate flex-1">{inviteLink}</span>
                <button
                  onClick={copyLink}
                  className="text-xs font-['Barlow_Condensed'] uppercase font-bold shrink-0 px-2 py-1"
                  style={{ color: '#1C1C1C' }}
                >
                  <Copy className="w-3 h-3 inline mr-1" />
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setApiOk(''); setInviteLink(''); }} className="text-green-500 hover:text-green-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error */}
      {apiError && (
        <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="font-['DM_Sans'] text-sm text-red-700 flex-1">{apiError}</span>
          <button onClick={() => setApiError('')} className="text-red-400 hover:text-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Users list */}
      {isLoading ? (
        <div className="text-center py-12 font-['DM_Sans'] text-gray-400">Cargando usuarios...</div>
      ) : (
        <div className="border border-gray-200 divide-y divide-gray-100">
          {(users ?? []).map((u: any) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ background: '#1C1C1C' }}>
                <span className="font-['Barlow_Condensed'] text-lg font-bold text-white">
                  {u.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-['DM_Sans'] text-sm font-semibold text-gray-900">{u.name}</p>
                  {u.id === self?.id && <span className="font-['DM_Sans'] text-xs text-gray-400">(tú)</span>}
                  <span className={`text-xs px-2 py-0.5 font-semibold font-['Barlow_Condensed'] uppercase ${ROLE_BADGE[u.role?.name] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABEL[u.role?.name] ?? u.role?.name}
                  </span>
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 font-semibold font-['Barlow_Condensed'] uppercase">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="font-['Space_Mono'] text-xs text-gray-400 truncate mt-0.5">{u.email}</p>
              </div>

              {isAdmin && u.id !== self?.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    title={u.whatsappOptIn ? 'WhatsApp activo — click para desactivar' : 'Activar notificaciones WhatsApp'}
                    onClick={() => whatsappToggle.mutate({ id: u.id, whatsappOptIn: !u.whatsappOptIn })}
                    className={`p-1.5 transition-colors ${u.whatsappOptIn ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`text-xs px-2.5 py-1 border font-['Barlow_Condensed'] uppercase font-medium transition-colors ${
                      u.isActive ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending invitations */}
      {canManage && (pendingInvites ?? []).length > 0 && (
        <div>
          <p className="font-['Barlow_Condensed'] uppercase tracking-widest text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Invitaciones pendientes
          </p>
          <div className="border border-gray-200 divide-y divide-gray-100">
            {(pendingInvites ?? []).map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: '#F5C218' }}>
                  <Mail className="w-4 h-4" style={{ color: '#1C1C1C' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-['Space_Mono'] text-sm text-gray-800 truncate">{inv.email}</p>
                  <p className="font-['DM_Sans'] text-xs text-gray-400">
                    {ROLE_LABEL[inv.role?.name] ?? inv.role?.name} · Expira {new Date(inv.expiresAt).toLocaleDateString('es-DO')}
                    {inv.invitedBy && ` · Invitado por ${inv.invitedBy.name}`}
                  </p>
                </div>
                <button
                  onClick={() => revokeMutation.mutate(inv.id.toString())}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roles info */}
      <div className="border-l-4 border-[#F5C218] bg-amber-50 p-4 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="font-['DM_Sans'] text-xs text-amber-800 space-y-1">
          <p><strong className="font-['Barlow_Condensed'] uppercase">Admin:</strong> acceso total, gestión de usuarios y categorías.</p>
          <p><strong className="font-['Barlow_Condensed'] uppercase">Supervisor:</strong> crea/edita proyectos, anula gastos, puede invitar usuarios.</p>
          <p><strong className="font-['Barlow_Condensed'] uppercase">Operador:</strong> registra gastos y los edita dentro de las primeras 24 horas.</p>
        </div>
      </div>

      {/* Modal Invitar */}
      {modal === 'invite' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1C1C1C' }}>
              <h3 className="font-['Barlow_Condensed'] uppercase tracking-wide text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4" style={{ color: '#F5C218' }} /> Invitar nuevo usuario
              </h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="border-l-4 border-red-500 bg-red-50 px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-['DM_Sans'] text-sm text-red-700">{apiError}</span>
                </div>
              )}
              <p className="font-['DM_Sans'] text-sm text-gray-600">
                Se enviará un correo con un enlace de activación. El usuario podrá crear su propia contraseña.
              </p>
              <div>
                <label className={labelCls}>Correo electrónico *</label>
                <input type="email"
                  className={`${inputCls} ${inviteForm.formState.errors.email ? 'border-red-400' : ''}`}
                  placeholder="correo@empresa.com"
                  {...inviteForm.register('email', { required: 'El correo es requerido' })} />
                {inviteForm.formState.errors.email && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{inviteForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Rol *</label>
                <select
                  className={`${inputCls} ${inviteForm.formState.errors.roleId ? 'border-red-400' : ''}`}
                  {...inviteForm.register('roleId', { required: 'Selecciona un rol' })}
                >
                  <option value="">— Selecciona un rol —</option>
                  {(roles ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
                  ))}
                </select>
                {inviteForm.formState.errors.roleId && (
                  <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{inviteForm.formState.errors.roleId.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={inviteMutation.isPending}
                  className="flex-1 py-2.5 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}>
                  {inviteMutation.isPending
                    ? <><span className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /> Enviando...</>
                    : <><Mail className="w-4 h-4" /> Enviar invitación</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modal === 'edit' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4" style={{ background: '#1C1C1C' }}>
              <h3 className="font-['Barlow_Condensed'] uppercase tracking-wide text-white">Editar usuario</h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="p-6 space-y-4">
              {apiError && (
                <div className="border-l-4 border-red-500 bg-red-50 px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-['DM_Sans'] text-sm text-red-700">{apiError}</span>
                </div>
              )}
              <div>
                <label className={labelCls}>Nombre *</label>
                <input className={`${inputCls} ${editForm.formState.errors.name ? 'border-red-400' : ''}`}
                  {...editForm.register('name', { required: 'Requerido' })} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" className={`${inputCls} ${editForm.formState.errors.email ? 'border-red-400' : ''}`}
                  {...editForm.register('email', { required: 'Requerido' })} />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input className={inputCls} {...editForm.register('phone')} />
              </div>
              <div>
                <label className={labelCls}>Rol *</label>
                <select className={inputCls} {...editForm.register('roleId', { required: 'Requerido' })}>
                  <option value="">— Rol —</option>
                  {(roles ?? []).map((r: any) => (
                    <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-300 font-['Barlow_Condensed'] uppercase text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 font-['Barlow_Condensed'] uppercase text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: '#F5C218', color: '#1C1C1C' }}>
                  {updateMutation.isPending
                    ? <><span className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /> Guardando...</>
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
