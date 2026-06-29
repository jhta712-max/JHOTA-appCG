import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorReportApi } from '../api';

interface Props { children: ReactNode; }
interface State {
  hasError: boolean;
  error?: Error;
  reportState: 'idle' | 'loading' | 'sent';
  description: string;
  reportOpen: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, reportState: 'idle', description: '', reportOpen: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  async handleReport() {
    this.setState({ reportState: 'loading' });
    try {
      await errorReportApi.report({
        message: this.state.error?.message ?? 'Error de renderizado React',
        endpoint: window.location.pathname,
        userDescription: this.state.description.trim() || undefined,
      });
    } catch { /* silencioso */ }
    this.setState({ reportState: 'sent' });
  }

  render() {
    if (this.state.hasError) {
      const { reportState, reportOpen, description } = this.state;
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h1>
            <p className="text-gray-500 mb-6">
              Ocurrió un error inesperado. Por favor recarga la página.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#F5C218] text-[#1C1C1C] font-medium"
              >
                Recargar página
              </button>

              {reportState === 'sent' ? (
                <p className="text-sm text-green-700 font-medium">✅ Reporte enviado. El administrador fue notificado.</p>
              ) : !reportOpen ? (
                <button
                  onClick={() => this.setState({ reportOpen: true })}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Reportar este error al administrador
                </button>
              ) : (
                <div className="w-full text-left space-y-2 mt-2">
                  <p className="text-sm text-gray-600">¿Qué estabas haciendo? (opcional)</p>
                  <textarea
                    value={description}
                    onChange={e => this.setState({ description: e.target.value })}
                    rows={2}
                    placeholder="Ej: Abrí la página de gastos y..."
                    className="w-full text-sm border border-gray-300 rounded p-2 text-gray-700 resize-none focus:outline-none focus:border-gray-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.handleReport()}
                      disabled={reportState === 'loading'}
                      className="text-sm px-3 py-1.5 bg-gray-800 text-white font-medium disabled:opacity-50"
                    >
                      {reportState === 'loading' ? 'Enviando...' : 'Enviar reporte'}
                    </button>
                    <button
                      onClick={() => this.setState({ reportOpen: false })}
                      className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
