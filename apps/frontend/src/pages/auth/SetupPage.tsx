import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShieldCheck, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../api/client';

type FormData = { name: string; email: string; password: string; confirm: string };

function AppLogo({ className = 'w-12 h-14' }: { className?: string }) {
  return <img src="/icon.png" alt="SERVINGMI" className={className} style={{ objectFit: 'contain' }}/>;
}

export default function SetupPage() {
  const navigate  = useNavigate();
  const [checking, setChecking] = useState(true);
  const [locked,   setLocked]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [apiError, setApiError] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>();
  const password = watch('password', '');

  // Verificar si el setup sigue disponible
  useEffect(() => {
    api.get('/setup/check')
      .then((r) => {
        // Solo bloqueamos si el backend confirma explícitamente que ya hay usuarios
        if (r.data?.data?.needsSetup === false) setLocked(true);
        setChecking(false);
      })
      .catch(() => {
        // Si el endpoint no responde, mostramos el formulario de todas formas.
        // El POST /auth/setup rechazará la petición si ya existen usuarios.
        setChecking(false);
      });
  }, []);

  const onSubmit = async (data: FormData) => {
    setApiError('');
    try {
      await api.post('/setup', {
        name:     data.name,
        email:    data.email,
        password: data.password,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 3500);
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Error al configurar el sistema');
    }
  };

  // ── Loading ──
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // ── Bloqueado (ya hay usuarios) ──
  if (locked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sistema ya configurado</h2>
          <p className="text-gray-500 text-sm mb-6">
            El sistema ya tiene usuarios registrados. Inicia sesión con tus credenciales
            o solicita acceso al administrador.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary w-full">
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  // ── Éxito ──
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Sistema configurado!</h2>
          <p className="text-gray-500 text-sm mb-1">El administrador fue creado exitosamente.</p>
          <p className="text-gray-400 text-xs">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  // ── Formulario de primer acceso ──
  return (
    <div className="min-h-screen flex" style={{ background: '#1C1C1C' }}>

      {/* Panel izquierdo */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12"
           style={{ background: '#141414' }}>
        <div className="flex items-center gap-3">
          <AppLogo className="w-10 h-12" />
          <div>
            <p className="font-bold text-white text-lg tracking-widest">Sistema de Gastos</p>
            <p className="text-xs text-gray-500">Control de Proyectos</p>
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30
                          text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <ShieldCheck className="w-3.5 h-3.5" /> Configuración inicial
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Primer acceso<br />
            <span style={{ color: '#F5C218' }}>al sistema</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Crea la cuenta de administrador principal. Este formulario
            solo está disponible una vez — cuando el sistema está vacío.
            Después, los nuevos usuarios se incorporan por invitación.
          </p>
        </div>

        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Sistema de Gastos · Sistema interno
        </p>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">

          {/* Header mobile */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-6">
            <AppLogo className="w-10 h-12" />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200
                          text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck className="w-3 h-3" /> Configuración inicial del sistema
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear administrador</h1>
          <p className="text-gray-500 text-sm mb-6">
            Este acceso solo es posible cuando no existe ningún usuario en el sistema.
          </p>

          {apiError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200
                            text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div>
              <label className="label">Nombre completo *</label>
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
              <label className="label">Correo electrónico *</label>
              <input
                type="email"
                className={`input-field ${errors.email ? 'input-error' : ''}`}
                placeholder="admin@empresa.com"
                {...register('email', {
                  required: 'El correo es requerido',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' },
                })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
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
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="label">Confirmar contraseña *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                className={`input-field ${errors.confirm ? 'input-error' : ''}`}
                placeholder="Repite la contraseña"
                {...register('confirm', {
                  required: 'Confirma la contraseña',
                  validate: (v) => v === password || 'Las contraseñas no coinciden',
                })}
              />
              {errors.confirm && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>
              )}
            </div>

            {/* Indicador de fortaleza */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[
                    { test: password.length >= 8,   label: '8+' },
                    { test: /[A-Z]/.test(password), label: 'A' },
                    { test: /[a-z]/.test(password), label: 'a' },
                    { test: /\d/.test(password),    label: '0' },
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
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base mt-2">
              {isSubmitting
                ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900
                                     rounded-full animate-spin" /> Configurando...</>
                : <><ShieldCheck className="w-4 h-4" /> Crear administrador</>
              }
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            <button onClick={() => navigate('/login')}
              className="text-primary-600 hover:underline">
              ← Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
