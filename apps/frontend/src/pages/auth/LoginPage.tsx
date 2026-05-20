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

function AppLogo({ className = 'w-12 h-14' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 1L39 11.5V36.5L20 47L1 36.5V11.5Z" fill="#1C1C1C" stroke="#F5C218" strokeWidth="1.5"/>
      <line x1="6"  y1="34" x2="22" y2="14" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
      <line x1="13" y1="38" x2="34" y2="14" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
      <line x1="18" y1="34" x2="34" y2="18" stroke="#F5C218" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
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

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido</h1>
          <p className="text-gray-500 text-sm mb-8">Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@empresa.com"
                className={`input-field ${errors.email ? 'input-error' : ''}`}
                {...register('email')}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña</label>
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

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base mt-2">
              {isSubmitting
                ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" /> Entrando...</>
                : <><LogIn className="w-4 h-4" /> Entrar al sistema</>
              }
            </button>
          </form>

          {/* Primer acceso — solo visible cuando no hay usuarios */}
          {needsSetup && (
            <div className="mt-6 border border-amber-200 bg-amber-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Sistema sin configurar
              </p>
              <p className="text-xs text-amber-600 mb-3">
                No existe ningún usuario. Configura el administrador principal para comenzar.
              </p>
              <button
                onClick={() => navigate('/setup')}
                className="w-full text-xs font-semibold text-amber-700 border border-amber-300
                           bg-white hover:bg-amber-50 rounded-lg py-2 transition-colors
                           flex items-center justify-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Configurar primer acceso
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Sistema interno — solo personal autorizado
          </p>
          <p className="text-center text-xs text-gray-300 mt-1">
            Desarrollado con <span className="text-gray-400">Cowork Claude AI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
