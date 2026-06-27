import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn, Eye, EyeOff, AlertCircle, Settings } from 'lucide-react';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/client';

const schema = z.object({
  email:    z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});
type FormData = z.infer<typeof schema>;

function AppLogo({ className = 'w-48' }: { className?: string }) {
  return <img src="/logo.png" alt="JHOTA Construcciones" className={className} style={{ objectFit: 'contain' }}/>;
}

export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);

  // Verificar si el sistema tiene usuarios registrados
  useEffect(() => {
    api.get('/setup/check')
      .then((r) => setNeedsSetup(r.data.data.needsSetup))
      .catch(() => {}); // silencioso — no interrumpir el login
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await authApi.login(data);
      const { accessToken, refreshToken } = res.data.data;
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setAuth(meRes.data.data, accessToken, refreshToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0D1B48' }}>

      {/* Panel izquierdo — branding (solo desktop) */}
      <div
        className="hidden lg:flex flex-col justify-between w-2/5 p-12"
        style={{ background: '#141414' }}
      >
        <div className="flex items-center">
          <AppLogo className="w-48" />
        </div>

        <div>
          <div className="border-t-2 w-12 mb-6" style={{ borderColor: '#1D4ED8' }} />
          <h2
            className="font-bold text-white uppercase tracking-widest mb-4"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '3.75rem',
              lineHeight: 1.0,
            }}
          >
            Control de gastos<br />
            <span style={{ color: '#1D4ED8' }}>por proyectos</span>
          </h2>
          <p
            className="text-gray-400 text-sm leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Gestiona los gastos de cada proyecto con trazabilidad completa,
            comprobantes fiscales DGII y reportes exportables.
          </p>
        </div>

        <p className="text-xs text-gray-600" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          © {new Date().getFullYear()} Sistema de Gastos · Sistema interno
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:p-6 bg-gray-50">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <AppLogo className="w-48" />
          </div>

          {/* Form card */}
          <div
            className="bg-white shadow-sm border border-gray-100 p-5 sm:p-8"
            style={{ borderLeft: '4px solid #1D4ED8' }}
          >
            <h1
              className="uppercase tracking-widest mb-1 text-3xl sm:text-4xl"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: '#0D1B48',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              Bienvenido
            </h1>
            <p
              className="text-gray-500 text-sm mb-7"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Ingresa tus credenciales para continuar
            </p>

            {error && (
              <div
                className="flex items-center gap-2 border text-red-700 rounded-none p-3 mb-5 text-sm"
                style={{
                  background: 'rgba(153,0,0,0.06)',
                  borderColor: '#f87171',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@empresa.com"
                  className="border border-gray-300 rounded-none px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-600"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-semibold hover:opacity-75 transition-opacity"
                    style={{ color: '#1D4ED8', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="border border-gray-300 rounded-none px-3 py-2.5 text-sm w-full pr-10 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
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
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 uppercase tracking-widest font-bold text-lg flex items-center justify-center gap-2 mt-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  background: '#1D4ED8',
                  color: '#ffffff',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar al sistema
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Primer acceso — solo visible cuando no hay usuarios */}
          {needsSetup && (
            <div
              className="mt-5 border-l-4 bg-yellow-50 p-4"
              style={{ borderLeftColor: '#1D4ED8' }}
            >
              <p
                className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Settings className="w-3.5 h-3.5" /> Sistema sin configurar
              </p>
              <p
                className="text-xs text-amber-600 mb-3"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                No existe ningún usuario. Configura el administrador principal para comenzar.
              </p>
              <button
                onClick={() => navigate('/setup')}
                className="w-full text-xs font-semibold text-amber-700 border border-amber-300 bg-white hover:bg-amber-50 rounded-none py-2 transition-colors flex items-center justify-center gap-1.5"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Settings className="w-3.5 h-3.5" /> Configurar primer acceso
              </button>
            </div>
          )}

          <p
            className="text-center text-xs text-gray-400 mt-6"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Sistema interno — solo personal autorizado
          </p>
          <p
            className="text-center text-xs text-gray-300 mt-1"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Desarrollado con <span className="text-gray-400">Cowork Claude AI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
