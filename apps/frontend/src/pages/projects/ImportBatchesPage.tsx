import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BatchImportModal from '../../components/BatchImportModal';

export default function ImportBatchesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-[#0D1B48] px-6 py-6">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-[#1D4ED8] text-xs font-['Barlow_Condensed'] tracking-widest uppercase mb-3 hover:opacity-80"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a proyectos
        </button>
        <p className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-[#1D4ED8] uppercase mb-1">
          MÓDULO / IMPORTACIÓN
        </p>
        <h1 className="font-['Barlow_Condensed'] text-5xl font-bold text-white uppercase tracking-tight">
          Importar Lotes desde CSV
        </h1>
        <p className="font-['DM_Sans'] text-sm text-gray-400 mt-1">
          Carga un archivo CSV con los gastos históricos para importarlos como lotes
        </p>
      </div>

      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">

        {/* Info Card */}
        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3">
            Instrucciones de uso
          </h2>
          <ol className="space-y-2 text-sm text-gray-600 font-['DM_Sans'] list-decimal list-inside">
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
        <div className="bg-white border border-[#1D4ED8]/40 p-6">
          <h3 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3">
            Formato del archivo CSV
          </h3>
          <p className="text-sm text-gray-600 font-['DM_Sans'] mb-3">
            El CSV debe incluir estas columnas (en cualquier orden):
          </p>
          <div className="border border-gray-200 overflow-x-auto mb-3">
            <table className="text-xs w-full">
              <thead className="bg-[#0D1B48]">
                <tr>
                  <th className="text-left p-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Campo</th>
                  <th className="text-left p-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Requerido</th>
                  <th className="text-left p-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">Ejemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">batch_code</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">MOPC-CCC-LPN-2021-0036</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">item_code</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">ITEM-5</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">provincia</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">Puerto Plata</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">sector</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">Puerto Plata Gualete</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">descripcion</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">ARENA</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">monto</td>
                  <td className="p-2 text-green-600 font-['DM_Sans']">✓</td>
                  <td className="p-2 text-gray-600 font-['Space_Mono'] text-xs">16200.0</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">categoria</td>
                  <td className="p-2 text-gray-400 font-['DM_Sans']">Opcional</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">Materiales</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">fecha</td>
                  <td className="p-2 text-gray-400 font-['DM_Sans']">Opcional</td>
                  <td className="p-2 text-gray-600 font-['Space_Mono'] text-xs">2021-06-15</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">proveedor</td>
                  <td className="p-2 text-gray-400 font-['DM_Sans']">Opcional</td>
                  <td className="p-2 text-gray-600 font-['DM_Sans']">Proveedor XYZ</td>
                </tr>
                <tr>
                  <td className="p-2 font-['Space_Mono'] text-[#1D4ED8] text-xs">metodo_pago</td>
                  <td className="p-2 text-gray-400 font-['DM_Sans']">Opcional</td>
                  <td className="p-2 text-gray-600 font-['Space_Mono'] text-xs">CASH</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 font-['DM_Sans']">
            Tip: Si los campos requeridos están vacíos, el registro será saltado con un mensaje de error.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 p-4">
            <h4 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">
              Validacion inteligente
            </h4>
            <p className="text-sm text-gray-600 font-['DM_Sans']">
              Detecta y reporta errores por fila sin detener la importación
            </p>
          </div>
          <div className="bg-white border border-gray-200 p-4">
            <h4 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">
              Sin duplicados
            </h4>
            <p className="text-sm text-gray-600 font-['DM_Sans']">
              Salta automáticamente registros duplicados
            </p>
          </div>
          <div className="bg-white border border-gray-200 p-4">
            <h4 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">
              Categorias automaticas
            </h4>
            <p className="text-sm text-gray-600 font-['DM_Sans']">
              Crea categorías inexistentes automáticamente
            </p>
          </div>
          <div className="bg-white border border-gray-200 p-4">
            <h4 className="font-['Barlow_Condensed'] text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">
              Calculos precisos
            </h4>
            <p className="text-sm text-gray-600 font-['DM_Sans']">
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
