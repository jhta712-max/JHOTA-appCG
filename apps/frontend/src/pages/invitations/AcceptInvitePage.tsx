import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle, AlertCircle, Eye, EyeOff, Receipt, Loader2 } from 'lucide-react';
import api from '../../api/client';

type FormData = { name: string; password: string; confirm: string };

const ROLE_LABEL: Record<string, string> = {
  admin:      'Administrador',
  supervisor: 'Supervisor',
  operator:   'Operador',
};

type InviteInfo = { email: string; roleName: string; expiresAt: string };

export default function AcceptInvitePage() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const [info,     setInfo]     = useState<InviteInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [invalid,  setInvalid]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [done,     setDone]     = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>();
  const password = watch('password', '');

  // Verificar token al cargar
  useEffect(() => {
    if (!token) { setInvalid('Token no válido'); setLoading(false); return; }

    api.get(`/invitations/verify/${token}`)
      .then((r) => {
        setInfo(r.data.data);
        setLoading(false);
      })
      .catch((err) => {
        setInvalid(err.response?.data?.error || 'Invitación no válida o expirada');
        setLoading(false);
      });
  }, [token]);

  const onSubmit = async (data: FormData) => {
    setApiError('');
    try {
      await api.post(`/invitations/accept/${token}`, {
        name:     data.name,
        password: data.password,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Error al activar la cuenta');
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  // ── Token inválido/expirado ──
  if (invalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invitación no válida</h2>
          <p className="text-gray-500 text-sm mb-6">{invalid}</p>
          <p className="text-gray-400 text-xs">Solicita una nueva invitación al administrador del sistema.</p>
        </div>
      </div>
    );
  }

  // ── Cuenta activada ──
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Cuenta activada!</h2>
          <p className="text-gray-500 text-sm mb-2">Tu cuenta ha sido creada exitosamente.</p>
          <p className="text-gray-400 text-xs">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <Receipt className="w-7 h-7 text-white" />
          </div>
          <h1 className="page-title" style={{ fontSize: '1.8rem' }}>Activa tu cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Sistema de Control de Gastos</p>
        </div>

        {/* Info de la invitación */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-semibold mb-1">Tu acceso</p>
          <p className="text-sm text-blue-800 font-medium">{info?.email}</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Rol: <strong>{ROLE_LABEL[info?.roleName ?? ''] ?? info?.roleName}</strong>
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">

          {apiError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <div>
            <label className="label">Tu nombre completo *</label>
            <input
              className={`input-field ${errors.name ? 'input-error' : ''}`}
              placeholder="Ej: Juan Pérez"
              {...register('name', {
                required: 'El nombre es requerido',
                minLength: { value: 2, message: 'Mínimo 2 caracteres' },
              })}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Contraseña *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={`input-field pr-10 ${errors.password ? 'input-error' : ''}`}
                placeholder="Mínimo 8 caracteres"
                {...register('password', {
                  required: 'La contraseña es requerida',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                    message: 'Debe incluir mayúscula, minúscula y número',
                  },
                })}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label">Confirmar contraseña *</label>
            <input
              type={showPass ? 'text' : 'password'}
              className={`input-field ${errors.confirm ? 'input-error' : ''}`}
              placeholder="Repite tu contraseña"
              {...register('confirm', {
                required: 'Confirma tu contraseña',
                validate: (v) => v === password || 'Las contraseñas no coinciden',
              })}
            />
            {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
          </div>

          {/* Indicador de fortaleza */}
          {password.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Fortaleza de la contraseña:</p>
              <div className="flex gap-1">
                {[
                  { test: password.length >= 8,      label: '8+ chars' },
                  { test: /[A-Z]/.test(password),    label: 'Mayúscula' },
                  { test: /[a-z]/.test(password),    label: 'Minúscula' },
                  { test: /\d/.test(password),       label: 'Número' },
                ].map((r) => (
                  <div key={r.label}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      r.test ? 'bg-green-400' : 'bg-gray-200'
                    }`} />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="btn-primary w-full py-3 text-base">
            <CheckCircle className="w-5 h-5" />
            Activar mi cuenta
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/login')} className="text-primary-600 hover:underline">
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
