import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../api/client';

const schema = z.object({
  email: z.string().email('Correo inválido'),
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

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud');
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

          {!submitted ? (
            <>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-6"
              >
                <ArrowLeft className="w-4 h-4" /> Volver al login
              </button>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">¿Olvidaste tu contraseña?</h1>
              <p className="text-gray-500 text-sm mb-8">
                Ingresa tu correo electrónico y te enviaremos un enlace para resetear tu contraseña.
              </p>

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

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base mt-6">
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-gray-900/40 border-t-gray-900 rounded-full animate-spin" /> Enviando...</>
                    : <><Mail className="w-4 h-4" /> Enviar instrucciones</>
                  }
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-50 rounded-full p-3">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Correo enviado!</h2>
              <p className="text-gray-600 text-sm mb-6">
                Si existe una cuenta con ese correo, recibirás un enlace para resetear tu contraseña en los próximos minutos.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-xs text-blue-700">
                  <strong>Nota:</strong> El enlace expirará en 1 hora por razones de seguridad.
                </p>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary py-3 text-base"
              >
                Volver al login
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Sistema interno — solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
