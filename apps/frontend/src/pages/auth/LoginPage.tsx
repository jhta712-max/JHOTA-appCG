import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle, Settings, ArrowRight } from 'lucide-react';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/client';

const schema = z.object({
  email:    z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});
type FormData = z.infer<typeof schema>;

const B = { dark: '#1C1C1C', yellow: '#F5C218', darkAlt: '#141414' } as const;
const DISPLAY = "'Barlow Condensed', system-ui, sans-serif";
const BODY    = "'DM Sans', system-ui, sans-serif";
const MONO    = "'Space Mono', monospace";

function AppLogo({ className = 'w-12 h-14' }: { className?: string }) {
  return <img src="/logo.png" alt="SERVINGMI" className={className} style={{ objectFit: 'contain' }} />;
}

export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!document.querySelector('[data-smi-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=Space+Mono:wght@400;700&display=swap';
      link.setAttribute('data-smi-fonts', '1');
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    api.get('/setup/check')
      .then((r) => setNeedsSetup(r.data.data.needsSetup))
      .catch(() => {});
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
    <div style={{ fontFamily: BODY, minHeight: '100vh', display: 'flex' }}>
      <style>{`
        @keyframes lg-fade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .lg-fade { animation: lg-fade 0.5s cubic-bezier(.2,.8,.2,1) both; }
        .lg-fade-1 { animation: lg-fade 0.5s 0.1s cubic-bezier(.2,.8,.2,1) both; }
        .lg-fade-2 { animation: lg-fade 0.5s 0.2s cubic-bezier(.2,.8,.2,1) both; }
        .smi-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: ${BODY};
          color: #111;
          background: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .smi-input:focus {
          border-color: #F5C218;
          box-shadow: 0 0 0 3px rgba(245,194,24,0.15);
        }
        .smi-input.error { border-color: #ef4444; }
        .smi-input.error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
        /* grid texture on left panel */
        .login-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>

      {/* ── LEFT PANEL — branding ──────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] login-grid"
           style={{ background: B.darkAlt, padding: '3rem 3.5rem' }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <AppLogo className="w-10 h-12" />
          <div>
            <p style={{ fontFamily: DISPLAY, fontWeight: 800, color: '#fff', fontSize: '1.1rem', letterSpacing: '0.08em' }}>
              SERVINGMI
            </p>
            <p style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#555', letterSpacing: '0.05em' }}>
              Sistema de Gastos
            </p>
          </div>
        </div>

        {/* Main message */}
        <div>
          <div style={{ width: '40px', height: '3px', background: B.yellow, marginBottom: '2rem', borderRadius: '2px' }} />
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 900, color: '#fff', lineHeight: 1.0,
                        fontSize: 'clamp(2.8rem, 4vw, 4rem)', letterSpacing: '-0.01em', marginBottom: '1.25rem' }}>
            CONTROL<br />DE GASTOS<br />
            <span style={{ color: B.yellow }}>POR PROYECTO</span>
          </h2>
          <p style={{ fontFamily: BODY, color: '#666', fontSize: '0.85rem', lineHeight: 1.7, maxWidth: '320px' }}>
            Gestiona los gastos de cada proyecto con trazabilidad completa,
            comprobantes fiscales DGII y reportes exportables.
          </p>

          {/* Feature list */}
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {['Presupuestos por proyecto', 'Reportes Excel / PDF', 'Cumplimiento DGII'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: B.yellow, flexShrink: 0 }} />
                <span style={{ fontFamily: BODY, color: '#888', fontSize: '0.78rem' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#333', letterSpacing: '0.06em' }}>
          © {new Date().getFullYear()} SISTEMA INTERNO
        </p>
      </div>

      {/* ── RIGHT PANEL — form ──────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     padding: '2rem', background: '#FAFAFA' }}>
        <div style={{ width: '100%', maxWidth: '400px' }} className="lg-fade">

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2.5rem', justifyContent: 'center' }}
               className="lg:hidden">
            <AppLogo className="w-10 h-12" />
            <div>
              <p style={{ fontFamily: DISPLAY, fontWeight: 800, color: B.dark, fontSize: '1.2rem', letterSpacing: '0.08em' }}>SERVINGMI</p>
              <p style={{ fontFamily: BODY, fontSize: '0.7rem', color: '#9ca3af' }}>Sistema de Gastos</p>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }} className="lg-fade-1">
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: '2.5rem', lineHeight: 1.0,
                          color: B.dark, letterSpacing: '-0.01em', marginBottom: '6px' }}>
              BIENVENIDO
            </h1>
            <p style={{ fontFamily: BODY, fontSize: '0.85rem', color: '#9ca3af' }}>
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px',
                           background: '#fef2f2', border: '1px solid #fecaca',
                           borderLeft: '3px solid #ef4444',
                           color: '#dc2626', borderRadius: '8px', padding: '12px 14px',
                           marginBottom: '1.25rem', fontSize: '0.82rem', fontFamily: BODY }}>
              <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="lg-fade-2">
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontFamily: BODY, fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                               letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block',
                               marginBottom: '6px' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="correo@empresa.com"
                className={`smi-input${errors.email ? ' error' : ''}`}
                {...register('email')}
              />
              {errors.email && (
                <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#ef4444', marginTop: '4px' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontFamily: BODY, fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                                  letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Contraseña
                </label>
                <button type="button" onClick={() => navigate('/forgot-password')}
                        style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#9ca3af',
                                   background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        className="hover:text-gray-600 transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`smi-input${errors.password ? ' error' : ''}`}
                  style={{ paddingRight: '2.75rem' }}
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                   background: 'none', border: 'none', cursor: 'pointer',
                                   color: '#9ca3af', padding: '2px' }}
                        className="hover:text-gray-600 transition-colors">
                  {showPwd ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ fontFamily: BODY, fontSize: '0.72rem', color: '#ef4444', marginTop: '4px' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting}
                    style={{ width: '100%', background: isSubmitting ? '#e5c800' : B.yellow,
                               color: B.dark, fontFamily: DISPLAY, fontWeight: 800,
                               fontSize: '1rem', letterSpacing: '0.08em',
                               padding: '0.85rem 1.5rem', borderRadius: '8px', border: 'none',
                               cursor: isSubmitting ? 'not-allowed' : 'pointer',
                               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                               transition: 'all 0.15s' }}>
              {isSubmitting ? (
                <>
                  <span style={{ width: '16px', height: '16px', border: `2px solid rgba(28,28,28,0.3)`,
                                   borderTopColor: B.dark, borderRadius: '50%', display: 'inline-block',
                                   animation: 'spin 0.7s linear infinite' }} />
                  ENTRANDO...
                </>
              ) : (
                <>ENTRAR AL SISTEMA <ArrowRight style={{ width: '16px', height: '16px' }} /></>
              )}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>

          {/* Setup notice */}
          {needsSetup && (
            <div style={{ marginTop: '1.5rem', border: `1px solid #fde68a`,
                           background: '#fffbeb', borderRadius: '10px', padding: '1rem' }}>
              <p style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: '0.85rem',
                           color: '#92400e', letterSpacing: '0.04em', marginBottom: '4px',
                           display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings style={{ width: '14px', height: '14px' }} />
                SISTEMA SIN CONFIGURAR
              </p>
              <p style={{ fontFamily: BODY, fontSize: '0.75rem', color: '#b45309', marginBottom: '10px' }}>
                No existe ningún usuario. Configura el administrador principal para comenzar.
              </p>
              <button onClick={() => navigate('/setup')}
                      style={{ width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: '0.85rem',
                                 letterSpacing: '0.05em', color: '#92400e', background: 'white',
                                 border: '1px solid #fcd34d', borderRadius: '6px',
                                 padding: '0.5rem', cursor: 'pointer',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      className="hover:bg-amber-50 transition-colors">
                <Settings style={{ width: '13px', height: '13px' }} />
                CONFIGURAR PRIMER ACCESO
              </button>
            </div>
          )}

          <p style={{ fontFamily: BODY, fontSize: '0.68rem', color: '#d1d5db', textAlign: 'center', marginTop: '2rem' }}>
            Sistema interno · Solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
