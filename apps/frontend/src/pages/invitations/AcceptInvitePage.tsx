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

const inputCls = "w-full font-['DM_Sans'] text-sm border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F5C218] focus:border-transparent bg-white";
const labelCls = "block font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

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

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1C1C1C' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#F5C218' }} />
          <p className="font-['DM_Sans'] text-gray-400 text-sm">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  // Token inválido/expirado
  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1C1C1C' }}>
        <div className="bg-white w-full max-w-md p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-['Barlow_Condensed'] text-xl font-bold uppercase tracking-wide text-gray-900 mb-2">
            Invitación no válida
          </h2>
          <p className="font-['DM_Sans'] text-gray-500 text-sm mb-6">{invalid}</p>
          <p className="font-['DM_Sans'] text-gray-400 text-xs">
            Solicita una nueva invitación al administrador del sistema.
          </p>
        </div>
      </div>
    );
  }

  // Cuenta activada
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1C1C1C' }}>
        <div className="bg-white w-full max-w-md p-8 text-center shadow-2xl">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ background: '#F5C218' }}>
            <CheckCircle className="w-7 h-7" style={{ color: '#1C1C1C' }} />
          </div>
          <h2 className="font-['Barlow_Condensed'] text-xl font-bold uppercase tracking-wide text-gray-900 mb-2">
            Cuenta activada
          </h2>
          <p className="font-['DM_Sans'] text-gray-500 text-sm mb-2">Tu cuenta ha sido creada exitosamente.</p>
          <p className="font-['DM_Sans'] text-gray-400 text-xs">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  // Formulario
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1C1C1C' }}>
      <div className="w-full max-w-md space-y-5">

        {/* Logo / branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#F5C218' }}>
            <Receipt className="w-7 h-7" style={{ color: '#1C1C1C' }} />
          </div>
          <h1 className="font-['Barlow_Condensed'] text-3xl font-bold uppercase tracking-tight text-white">
            Activa tu cuenta
          </h1>
          <p className="font-['DM_Sans'] text-gray-400 text-sm mt-1">Sistema de Control de Gastos</p>
        </div>

        {/* Info de la invitación */}
        <div className="bg-[#F5C218]/10 border border-[#F5C218]/30 p-4">
          <p className="font-['Barlow_Condensed'] text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: '#F5C218' }}>
            Tu acceso
          </p>
          <p className="font-['DM_Sans'] text-sm text-white font-medium">{info?.email}</p>
          <p className="font-['DM_Sans'] text-xs text-gray-400 mt-0.5">
            Rol: <strong className="text-gray-300">{ROLE_LABEL[info?.roleName ?? ''] ?? info?.roleName}</strong>
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white p-6 shadow-2xl space-y-4">

          {/* Header of form panel */}
          <div className="-mx-6 -mt-6 px-6 pt-4 pb-3 mb-2" style={{ background: '#1C1C1C' }}>
            <h2 className="font-['Barlow_Condensed'] text-lg font-bold uppercase tracking-wide text-white">
              Configura tu contraseña
            </h2>
          </div>

          {apiError && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-800 text-red-400 p-3 text-sm font-['DM_Sans']">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <div>
            <label className={labelCls}>Tu nombre completo *</label>
            <input
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              placeholder="Ej: Juan Pérez"
              {...register('name', {
                required: 'El nombre es requerido',
                minLength: { value: 2, message: 'Mínimo 2 caracteres' },
              })}
            />
            {errors.name && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Contraseña *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className={`${inputCls} pr-10 ${errors.password ? 'border-red-400' : ''}`}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className={labelCls}>Confirmar contraseña *</label>
            <input
              type={showPass ? 'text' : 'password'}
              className={`${inputCls} ${errors.confirm ? 'border-red-400' : ''}`}
              placeholder="Repite tu contraseña"
              {...register('confirm', {
                required: 'Confirma tu contraseña',
                validate: (v) => v === password || 'Las contraseñas no coinciden',
              })}
            />
            {errors.confirm && <p className="font-['DM_Sans'] text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
          </div>

          {/* Indicador de fortaleza */}
          {password.length > 0 && (
            <div className="space-y-1">
              <p className="font-['DM_Sans'] text-xs text-gray-500">Fortaleza de la contraseña:</p>
              <div className="flex gap-1">
                {[
                  { test: password.length >= 8,      label: '8+ chars' },
                  { test: /[A-Z]/.test(password),    label: 'Mayúscula' },
                  { test: /[a-z]/.test(password),    label: 'Minúscula' },
                  { test: /\d/.test(password),       label: 'Número' },
                ].map((r) => (
                  <div key={r.label}
                    className={`flex-1 h-1.5 transition-colors ${r.test ? 'bg-green-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="w-full py-3 font-['Barlow_Condensed'] uppercase text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: '#F5C218', color: '#1C1C1C' }}
          >
            <CheckCircle className="w-5 h-5" />
            Activar mi cuenta
          </button>
        </div>

        <p className="text-center font-['DM_Sans'] text-xs text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/login')} className="hover:underline" style={{ color: '#F5C218' }}>
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
