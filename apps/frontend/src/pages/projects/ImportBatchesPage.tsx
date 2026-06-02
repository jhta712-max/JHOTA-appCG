import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BatchImportModal from '../../components/BatchImportModal';

export default function ImportBatchesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/projects')}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importar Lotes desde CSV</h1>
            <p className="text-sm text-gray-500 mt-1">
              Carga un archivo CSV con los gastos históricos para importarlos como lotes
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Instrucciones de uso:</h2>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Prepara un archivo CSV con el siguiente formato</li>
            <li>
              Asegúrate que el código del lote (batch_code) coincida con un proyecto existente
            </li>
            <li>Haz clic en "Seleccionar archivo" y elige tu CSV</li>
            <li>Haz clic en "Importar CSV" y espera a que se complete</li>
            <li>Los gastos se importarán automáticamente con sus categorías</li>
          </ol>
        </div>

        {/* CSV Format Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">Formato del archivo CSV</h3>
          <p className="text-sm text-blue-800 mb-3">
            El CSV debe incluir estas columnas (en cualquier orden):
          </p>
          <div className="bg-white rounded p-3 mb-3 overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-2 font-medium text-gray-700">Campo</th>
                  <th className="text-left p-2 font-medium text-gray-700">Requerido</th>
                  <th className="text-left p-2 font-medium text-gray-700">Ejemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-2 font-mono text-blue-600">batch_code</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">MOPC-CCC-LPN-2021-0036</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">item_code</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">ITEM-5</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">provincia</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">Puerto Plata</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">sector</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">Puerto Plata Gualete</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">descripcion</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">ARENA</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">monto</td>
                  <td className="p-2 text-green-600">✓</td>
                  <td className="p-2">16200.0</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">categoria</td>
                  <td className="p-2 text-gray-500">Opcional</td>
                  <td className="p-2">Materiales</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">fecha</td>
                  <td className="p-2 text-gray-500">Opcional</td>
                  <td className="p-2">2021-06-15</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">proveedor</td>
                  <td className="p-2 text-gray-500">Opcional</td>
                  <td className="p-2">Proveedor XYZ</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono text-blue-600">metodo_pago</td>
                  <td className="p-2 text-gray-500">Opcional</td>
                  <td className="p-2">CASH</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-blue-700">
            💡 Tip: Si los campos requeridos están vacíos, el registro será saltado con un mensaje de error.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✓ Validación Inteligente</h4>
            <p className="text-sm text-green-700">
              Detecta y reporta errores por fila sin detener la importación
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✓ Sin Duplicados</h4>
            <p className="text-sm text-green-700">
              Salta automáticamente registros duplicados
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✓ Categorías Automáticas</h4>
            <p className="text-sm text-green-700">
              Crea categorías inexistentes automáticamente
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">✓ Cálculos Precisos</h4>
            <p className="text-sm text-green-700">
              Actualiza presupuestos de items y lotes automáticamente
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <BatchImportModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          navigate('/projects');
        }}
        onSuccess={() => {
          navigate('/projects');
        }}
      />
    </div>
  );
}
