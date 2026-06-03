import { AlertCircle } from 'lucide-react';

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
  if (!error) return null;

  const status = error.response?.status;
  const errorData = error.response?.data;
  const errorCode = errorData?.code;
  const errorMessage = errorData?.error || error.message || 'Error desconocido';
  const validationDetails = errorData?.details;

  return (
    <div className={`flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 ${className}`}>
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{errorMessage}</p>

        {/* Mensaje específico según el código de error */}
        {errorCode === 'UNAUTHORIZED' && (
          <p className="text-xs text-red-600 mt-1">Tu sesión ha expirado. Por favor, inicia sesión nuevamente.</p>
        )}

        {errorCode === 'FORBIDDEN' && (
          <p className="text-xs text-red-600 mt-1">No tienes permisos para realizar esta acción. Se requiere mayor nivel de acceso.</p>
        )}

        {/* Detalles de validación */}
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

        {/* Fallback para otros errores */}
        {status && status >= 500 && !errorCode && (
          <p className="text-xs text-red-600 mt-1">Error del servidor. Por favor, intenta nuevamente más tarde.</p>
        )}
      </div>
    </div>
  );
}
