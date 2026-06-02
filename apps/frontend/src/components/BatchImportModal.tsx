import { useState, useRef } from 'react';
import { Upload, X, Loader, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface ImportResult {
  success: boolean;
  data?: {
    projectCode: string;
    batchCode: string;
    itemsCount: number;
    expensesCreated: number;
    expensesSkipped: number;
    errorRecords: number;
    totalBudget: string;
    errors: string[];
  };
  message?: string;
  error?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectCode?: string;
  onSuccess?: (result: ImportResult) => void;
}

export default function BatchImportModal({ isOpen, onClose, projectCode, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { accessToken } = useAuthStore((s) => ({
    accessToken: s.accessToken,
  }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setResult(null);
    } else {
      alert('Por favor selecciona un archivo CSV válido');
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('Por favor selecciona un archivo CSV');
      return;
    }

    if (!accessToken) {
      alert('No autenticado');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${apiUrl}/batches/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data: ImportResult = await response.json();

      if (response.ok) {
        setResult(data);
        onSuccess?.(data);
      } else {
        setResult({
          success: false,
          error: data.message || 'Error en la importación',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Error al conectar con el servidor',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Importar Lotes desde CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!result ? (
            <>
              {/* File Upload */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Clic para seleccionar CSV'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  o arrastra el archivo aquí
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Formato esperado:</strong> El CSV debe contener los siguientes campos:
                </p>
                <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                  <li><code>batch_code</code> - Código del lote</li>
                  <li><code>item_code</code> - Código del item</li>
                  <li><code>provincia</code> - Provincia</li>
                  <li><code>sector</code> - Sector/Barrio</li>
                  <li><code>descripcion</code> - Descripción del gasto</li>
                  <li><code>monto</code> - Monto numérico</li>
                  <li><code>categoria</code> - Categoría (Materiales, Mano de obra, etc.)</li>
                  <li><code>fecha</code> - Fecha (YYYY-MM-DD)</li>
                  <li><code>metodo_pago</code> - Método de pago (CASH, TRANSFER, etc.)</li>
                </ul>
              </div>

              {/* Features */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Características:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✅ Manejo automático de errores sin detener la importación</li>
                  <li>✅ Detección automática de registros duplicados</li>
                  <li>✅ Creación automática de categorías no existentes</li>
                  <li>✅ Cálculo automático de presupuestos</li>
                  <li>✅ Reporte detallado de resultados</li>
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar CSV
                  </>
                )}
              </button>
            </>
          ) : result.success && result.data ? (
            // Success Result
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-900">¡Importación completada!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Se importaron exitosamente los gastos del lote.
                  </p>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-900">
                    {result.data.expensesCreated}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Gastos creados</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-900">
                    {result.data.expensesSkipped}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">Duplicados saltados</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-900">
                    {result.data.itemsCount}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">Items creados</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-lg font-bold text-green-900">
                    RD$
                    {parseInt(result.data.totalBudget).toLocaleString('es-DO')}
                  </p>
                  <p className="text-xs text-green-700 mt-1">Presupuesto total</p>
                </div>
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p>
                  <strong>Proyecto:</strong> {result.data.projectCode}
                </p>
                <p>
                  <strong>Lote:</strong> {result.data.batchCode}
                </p>
                {result.data.errorRecords > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-yellow-900 font-medium mb-2">
                      {result.data.errorRecords} registros con errores:
                    </p>
                    <ul className="text-xs text-yellow-800 space-y-1 max-h-24 overflow-y-auto">
                      {result.data.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Error Result
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Error en la importación</p>
                  <p className="text-sm text-red-700 mt-1">
                    {result.error || 'Hubo un problema al procesar el archivo'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResult(null)}
                className="w-full btn-secondary"
              >
                Volver a intentar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="border-t p-6 flex gap-3 justify-end">
            <button onClick={onClose} className="btn-primary">
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
