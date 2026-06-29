import { useState } from 'react';
import { AlertCircle, Flag, CheckCircle } from 'lucide-react';
import { errorReportApi } from '../api';

interface ErrorDetails {
  [field: string]: string[];
}

interface ApiError {
  response?: {
    status: number;
    data?: {
      error?: string;
      code?: string;
      details?: ErrorDetails;
    };
  };
  message?: string;
}

interface ErrorAlertProps {
  error: ApiError | null;
  className?: string;
}

export function ErrorAlert({ error, className = '' }: ErrorAlertProps) {
  const [reportOpen, setReportOpen]     = useState(false);
  const [description, setDescription]   = useState('');
  const [reportState, setReportState]   = useState<'idle' | 'loading' | 'sent'>('idle');

  if (!error) return null;

  const status       = error.response?.status;
  const errorData    = error.response?.data;
  const errorCode    = errorData?.code;
  const errorMessage = errorData?.error || error.message || 'Error desconocido';
  const validationDetails = errorData?.details;

  const showReportButton = !status || status >= 500 || (!errorCode && status !== 400 && status !== 422);

  async function handleReport() {
    setReportState('loading');
    try {
      await errorReportApi.report({
        message: errorMessage,
        statusCode: status,
        endpoint: window.location.pathname,
        userDescription: description.trim() || undefined,
      });
      setReportState('sent');
    } catch {
      setReportState('sent');
    }
  }

  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">{errorMessage}</p>

          {errorCode === 'UNAUTHORIZED' && (
            <p className="text-xs text-red-600 mt-1">Tu sesión ha expirado. Por favor, inicia sesión nuevamente.</p>
          )}
          {errorCode === 'FORBIDDEN' && (
            <p className="text-xs text-red-600 mt-1">No tienes permisos para realizar esta acción.</p>
          )}

          {validationDetails && Object.keys(validationDetails).length > 0 && (
            <div className="text-xs text-red-600 mt-2">
              <p className="font-semibold">Errores de validación:</p>
              <ul className="list-disc list-inside mt-1">
                {Object.entries(validationDetails).map(([field, errors]) => (
                  <li key={field}>
                    <strong>{field}:</strong> {Array.isArray(errors) ? errors[0] : errors}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status && status >= 500 && !errorCode && (
            <p className="text-xs text-red-600 mt-1">Error del servidor. Por favor, intenta nuevamente más tarde.</p>
          )}
        </div>
      </div>

      {showReportButton && (
        <div className="mt-3 border-t border-red-200 pt-3">
          {reportState === 'sent' ? (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span>Reporte enviado. El administrador fue notificado.</span>
            </div>
          ) : !reportOpen ? (
            <button
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              <Flag className="w-3.5 h-3.5" />
              Reportar este error al administrador
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-600 font-medium">¿Qué estabas haciendo cuando ocurrió? (opcional)</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Ej: Intentaba guardar un gasto del proyecto X..."
                className="w-full text-xs border border-red-200 rounded p-2 text-gray-700 resize-none focus:outline-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReport}
                  disabled={reportState === 'loading'}
                  className="text-xs px-3 py-1.5 bg-red-600 text-white font-medium disabled:opacity-50"
                >
                  {reportState === 'loading' ? 'Enviando...' : 'Enviar reporte'}
                </button>
                <button
                  onClick={() => setReportOpen(false)}
                  className="text-xs px-3 py-1.5 border border-red-200 text-red-600"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
