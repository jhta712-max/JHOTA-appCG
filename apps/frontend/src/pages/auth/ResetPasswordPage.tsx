import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../api/client';

const schema = z
  .object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

function AppLogo({ className = 'w-12 h-14' }: { className?: string }) {
  return <img src="/logo.png" alt="SERVINGMI" className={className} style={{ objectFit: 'contain' }}/>;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
    }
  }, [token]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    if (!token) return;

    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al resetear la contraseña');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#1C1C1C' }}>
      {/* Panel izquierdo — branding (solo desktop) */}
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
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Control de gastos<br />
            <span style={{ color: '#F5C218' }}>por proyectos</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Gestiona los gastos de cada proyecto con trazabilidad completa,
            comprobantes fiscales DGII y reportes exportables.
          </p>
        </div>

        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Sistema de Gastos · Sistema interno
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <AppLogo className="w-10 h-12" />
            <div>
              <p className="font-bold text-gray-900 text-xl tracking-widest">Sistema de Gastos</p>
              <p className="text-xs text-gray-500">Control de Proyectos</p>
            </div>
          </div>

          {invalidToken ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-red-50 rounded-full p-3">
                  <AlertCircle className="w-12 h-12 text-red-600" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
              <p className="text-gray-600 text-sm mb-6">
                El enlace de reset no es válido o ha expirado.
              </p>

              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full btn-primary py-3 text-base"
              >
                Solicitar nuevo enlace
              </button>
            </div>
          ) : success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-50 rounded-full p-3">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Contraseña actualizada!</h2>
              <p className="text-gray-600 text-sm mb-6">
                Tu contraseña ha sido resetada exitosamente. Puedes iniciar sesión con tu nueva contraseña.
              </p>

              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary py-3 text-base"
              >
                Ir al login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Resetear contraseña</h1>
              <p className="text-gray-500 text-sm mb-8">Ingresa tu nueva contraseña</p>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="label">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`input-field pr-10 ${errors.password ? 'input-error' : ''}`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="label">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`input-field pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base mt-6">
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" /> Actualizando...</>
                    : <><Lock className="w-4 h-4" /> Resetear contraseña</>
                  }
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Sistema interno — solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
